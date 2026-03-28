#!/usr/bin/env node
/**
 * google-reviews.js — Google Business Profile reviews sync.
 *
 * Fetches customer reviews from your Google Business Profile (formerly Google My Business)
 * and syncs them to context/google/reviews.md for use by /review-miner and /audience-segments.
 *
 * Usage:
 *   node scripts/google-reviews.js --list
 *   node scripts/google-reviews.js --sync          # writes to context/google/reviews.md
 *   node scripts/google-reviews.js --setup-info    # shows account/location IDs needed in .env
 *
 * Requires .env:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *   GOOGLE_BUSINESS_ACCOUNT_ID   (from --setup-info)
 *   GOOGLE_BUSINESS_LOCATION_ID  (from --setup-info)
 *
 * Note: Google Business Profile API requires your app to be verified.
 * For testing, request API access at: https://developers.google.com/my-business/content/prereqs
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { getAccessToken } = require("./google-auth");

const ACCT_ID = process.env.GOOGLE_BUSINESS_ACCOUNT_ID || "";
const LOC_ID = process.env.GOOGLE_BUSINESS_LOCATION_ID || "";
const CONTEXT_DIR = path.resolve(__dirname, "..", "context", "google");

// Business Profile API base
const ACCT_MGT = "https://mybusinessaccountmanagement.googleapis.com/v1";
const REVIEWS_BASE = "https://mybusiness.googleapis.com/v4";

// ── Helpers ──────────────────────────────────────────────────────────────────

function bpRequest(method, url, token) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`Business Profile API ${res.statusCode}: ${data.slice(0, 400)}`));
          } else {
            resolve(data ? JSON.parse(data) : {});
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function starRating(rating) {
  const map = { ONE: "⭐", TWO: "⭐⭐", THREE: "⭐⭐⭐", FOUR: "⭐⭐⭐⭐", FIVE: "⭐⭐⭐⭐⭐" };
  return map[rating] || rating || "";
}

// ── Operations ────────────────────────────────────────────────────────────────

async function setupInfo(token) {
  console.log("\n📍 Fetching your Google Business Profile accounts...\n");

  try {
    const accounts = await bpRequest("GET", `${ACCT_MGT}/accounts`, token);
    if (!accounts.accounts?.length) {
      console.log("No Business Profile accounts found. Make sure your Google account has a Business Profile.");
      return;
    }

    for (const acct of accounts.accounts) {
      console.log(`Account: ${acct.accountName}`);
      console.log(`Account ID: ${acct.name}  ← use the last segment after "accounts/"`);
      console.log(`Type: ${acct.type}`);
      console.log();
    }

    const firstAcct = accounts.accounts[0].name; // e.g. "accounts/123456789"
    console.log("Fetching locations for first account...\n");

    try {
      const locations = await bpRequest(
        "GET",
        `https://mybusinessbusinessinformation.googleapis.com/v1/${firstAcct}/locations?readMask=name,title,storefrontAddress`,
        token
      );

      for (const loc of (locations.locations || [])) {
        console.log(`Location: ${loc.title || loc.name}`);
        console.log(`Location ID: ${loc.name}  ← use the last segment after "locations/"`);
        console.log(`Address: ${JSON.stringify(loc.storefrontAddress || {})}`);
        console.log();
      }
    } catch (err) {
      console.log(`Could not fetch locations: ${err.message}`);
    }

    console.log("\nAdd to .env:");
    console.log(`GOOGLE_BUSINESS_ACCOUNT_ID=${firstAcct.replace("accounts/", "")}`);
    console.log("GOOGLE_BUSINESS_LOCATION_ID=<location-id-from-above>");

  } catch (err) {
    if (err.message.includes("403") || err.message.includes("PERMISSION_DENIED")) {
      console.log("⚠️  Access denied. The Business Profile API requires app verification.");
      console.log("   Request access at: https://developers.google.com/my-business/content/prereqs");
      console.log("\n   For now, you can manually add reviews using the Telegram bot /save_review command.");
    } else {
      throw err;
    }
  }
}

async function fetchReviews(token) {
  if (!ACCT_ID || !LOC_ID) {
    throw new Error(
      "Missing GOOGLE_BUSINESS_ACCOUNT_ID or GOOGLE_BUSINESS_LOCATION_ID in .env\n" +
      "Run: node scripts/google-reviews.js --setup-info"
    );
  }

  const url = `${REVIEWS_BASE}/accounts/${ACCT_ID}/locations/${LOC_ID}/reviews?pageSize=50`;
  const result = await bpRequest("GET", url, token);
  return result.reviews || [];
}

async function listReviews(token) {
  const reviews = await fetchReviews(token);
  if (reviews.length === 0) { console.log("(no reviews found)"); return; }

  console.log(`\n⭐ Google Business Profile Reviews (${reviews.length}):\n`);
  for (const r of reviews) {
    const stars = starRating(r.starRating);
    const name = r.reviewer?.displayName || "Anonymous";
    const date = r.createTime?.slice(0, 10) || "";
    const comment = r.comment || "(no comment)";
    console.log(`  ${stars} ${name} — ${date}`);
    console.log(`  "${comment.slice(0, 150)}${comment.length > 150 ? "..." : ""}"`);
    if (r.reviewReply?.comment) {
      console.log(`  ↩ Owner reply: "${r.reviewReply.comment.slice(0, 100)}..."`);
    }
    console.log();
  }
}

async function syncToContext(token) {
  if (!fs.existsSync(CONTEXT_DIR)) fs.mkdirSync(CONTEXT_DIR, { recursive: true });

  let reviews = [];
  let apiWorked = true;

  try {
    reviews = await fetchReviews(token);
  } catch (err) {
    apiWorked = false;
    console.warn(`  ⚠ Could not fetch reviews via API: ${err.message.slice(0, 100)}`);
    console.warn("  → Writing placeholder file. Add reviews manually or use /save_review in Telegram bot.");
  }

  const today = new Date().toISOString().slice(0, 10);
  const ratingCounts = { FIVE: 0, FOUR: 0, THREE: 0, TWO: 0, ONE: 0 };
  for (const r of reviews) ratingCounts[r.starRating] = (ratingCounts[r.starRating] || 0) + 1;

  const avgRating = reviews.length
    ? ((ratingCounts.FIVE * 5 + ratingCounts.FOUR * 4 + ratingCounts.THREE * 3 + ratingCounts.TWO * 2 + ratingCounts.ONE * 1) / reviews.length).toFixed(1)
    : "N/A";

  const lines = [
    `# Google Business Profile Reviews`,
    `*Synced ${today}${apiWorked ? ` — ${reviews.length} reviews` : " — API unavailable, add reviews manually"}*`,
    "",
  ];

  if (reviews.length > 0) {
    lines.push(`## Summary`);
    lines.push(`- **Average Rating:** ${avgRating} / 5`);
    lines.push(`- **Total Reviews:** ${reviews.length}`);
    lines.push(`- **5⭐:** ${ratingCounts.FIVE || 0}  **4⭐:** ${ratingCounts.FOUR || 0}  **3⭐:** ${ratingCounts.THREE || 0}  **2⭐:** ${ratingCounts.TWO || 0}  **1⭐:** ${ratingCounts.ONE || 0}`);
    lines.push("");

    lines.push(`## Reviews`);
    lines.push("");
    for (const r of reviews) {
      const stars = starRating(r.starRating);
      const name = r.reviewer?.displayName || "Anonymous";
      const date = r.createTime?.slice(0, 10) || "";
      const comment = r.comment || "(no comment)";
      lines.push(`### ${stars} ${name} — ${date}`);
      lines.push(comment);
      if (r.reviewReply?.comment) {
        lines.push(`\n> **Owner reply:** ${r.reviewReply.comment}`);
      }
      lines.push("");
    }
  } else if (!apiWorked) {
    lines.push("## Manual Entries");
    lines.push("*(Add reviews here manually or via /save_review in the Telegram bot)*");
    lines.push("");
  }

  const outPath = path.join(CONTEXT_DIR, "reviews.md");

  // Preserve existing manual entries if any
  if (fs.existsSync(outPath)) {
    const existing = fs.readFileSync(outPath, "utf8");
    const manualSection = existing.match(/## Manual Entries\n[\s\S]*/);
    if (manualSection && !reviews.some(r => r.comment)) {
      lines.push(manualSection[0]);
    }
  }

  fs.writeFileSync(outPath, lines.join("\n"));
  if (apiWorked) {
    console.log(`✅ ${reviews.length} Google reviews synced to context/google/reviews.md`);
  } else {
    console.log(`✅ Placeholder created at context/google/reviews.md`);
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const flag = (f) => args.includes(f);

  const token = await getAccessToken();

  if (flag("--setup-info")) {
    await setupInfo(token);
  } else if (flag("--list")) {
    await listReviews(token);
  } else if (flag("--sync")) {
    await syncToContext(token);
  } else {
    console.log(`
Google Business Profile Reviews CLI

Usage:
  node scripts/google-reviews.js --setup-info   # find your account/location IDs
  node scripts/google-reviews.js --list
  node scripts/google-reviews.js --sync

Env: GOOGLE_BUSINESS_ACCOUNT_ID, GOOGLE_BUSINESS_LOCATION_ID

Note: The Business Profile API requires app verification from Google.
If unavailable, reviews can be added manually to context/google/reviews.md
    `);
  }
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  if (err.message.includes("Missing credentials") || err.message.includes("GOOGLE_REFRESH_TOKEN")) {
    console.error("Run: node scripts/google-setup.js");
  }
  process.exit(1);
});
