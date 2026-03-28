#!/usr/bin/env node

/**
 * Meta Ads Library Sync — Pulls competitor and inspiration ads from the
 * Meta Ads Library (public transparency API) into context/meta/ads-library.md
 *
 * Usage:
 *   node scripts/meta-ads-library.js
 *   node scripts/meta-ads-library.js --terms "gift shop,flower delivery"
 *   node scripts/meta-ads-library.js --pages "123456789,987654321"
 *
 * Requires .env with:
 *   META_USER_ACCESS_TOKEN — User Access Token (NOT the Page token — the Ads Library API requires a user token)
 *                            Get from Graph API Explorer while logged in as your ad account user.
 *                            Falls back to META_ACCESS_TOKEN if not set.
 *   META_AD_SEARCH_TERMS  — Comma-separated keywords (e.g. "gift shop ph,flower delivery manila")
 *   META_COMPETITOR_PAGE_IDS — Comma-separated Facebook Page IDs of competitors
 *   META_AD_COUNTRY       — ISO country code, defaults to PH
 *
 * NOTE: If you get error 2332004 "Se requiere un rol de la aplicación", you also need to:
 *   1. Visit https://www.facebook.com/ads/library and accept the Ads Library Terms of Service
 *      while logged in as the account that owns the token.
 *   2. Make sure META_USER_ACCESS_TOKEN is set to a User token, not a Page token.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// ── Load .env ──────────────────────────────────────────────────────────────

const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

// ── Config ─────────────────────────────────────────────────────────────────

// Ads Library API requires a User Access Token, not a Page Access Token.
// META_USER_ACCESS_TOKEN takes priority; falls back to META_ACCESS_TOKEN.
const ACCESS_TOKEN =
  process.env.META_USER_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;
const CONTEXT_DIR = path.resolve(__dirname, "..", "context", "meta");

if (!ACCESS_TOKEN) {
  console.error("❌ Neither META_USER_ACCESS_TOKEN nor META_ACCESS_TOKEN is set in .env");
  process.exit(1);
}

if (!process.env.META_USER_ACCESS_TOKEN) {
  console.warn(
    "⚠ Using META_ACCESS_TOKEN (Page token). The Ads Library API requires a User token.\n" +
    "  Set META_USER_ACCESS_TOKEN in .env with your personal user token from Graph API Explorer."
  );
}

// Read config — CLI flags override .env
const args = process.argv.slice(2);
function getArg(flag) {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : null;
}

const rawTerms = getArg("--terms") || process.env.META_AD_SEARCH_TERMS || "";
const rawPages = getArg("--pages") || process.env.META_COMPETITOR_PAGE_IDS || "";
const COUNTRY = process.env.META_AD_COUNTRY || "PH";
const LIMIT = 20;

const SEARCH_TERMS = rawTerms
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const COMPETITOR_PAGE_IDS = rawPages
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (SEARCH_TERMS.length === 0 && COMPETITOR_PAGE_IDS.length === 0) {
  console.error(
    "❌ No search terms or competitor page IDs configured.\n" +
      "   Set META_AD_SEARCH_TERMS and/or META_COMPETITOR_PAGE_IDS in .env\n" +
      "   Or pass --terms <terms> / --pages <page_ids>"
  );
  process.exit(1);
}

// ── HTTP helper ────────────────────────────────────────────────────────────

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 400) {
              reject(
                new Error(
                  `HTTP ${res.statusCode}: ${JSON.stringify(parsed.error || parsed)}`
                )
              );
            } else {
              resolve(parsed);
            }
          } catch {
            reject(new Error(`JSON parse error: ${data.slice(0, 200)}`));
          }
        });
      })
      .on("error", reject);
  });
}

// ── Meta Ads Library API ───────────────────────────────────────────────────

const AD_FIELDS = [
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "ad_creative_link_descriptions",
  "ad_creative_link_captions",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "page_name",
  "page_id",
  "publisher_platforms",
  "ad_snapshot_url",
].join(",");

/**
 * Fetch ads from Meta Ads Library.
 * Either searchTerm or pageId (not both) should be provided.
 * Returns { ads: [], blocked: bool }
 */
async function fetchAds({ searchTerm, pageId }) {
  const params = new URLSearchParams({
    ad_type: "ALL",
    ad_reached_countries: JSON.stringify([COUNTRY]),
    fields: AD_FIELDS,
    limit: String(LIMIT),
    access_token: ACCESS_TOKEN,
  });

  if (searchTerm) params.set("search_terms", searchTerm);
  if (pageId) params.set("search_page_ids", pageId);

  const url = `${BASE_URL}/ads_archive?${params.toString()}`;

  try {
    const result = await httpGet(url);
    return { ads: result.data || [], blocked: false };
  } catch (err) {
    // Error code 10 / subcode 2332004 = app not approved for Ads Library API
    if (err.message.includes('"code":10') || err.message.includes("2332004")) {
      return { ads: [], blocked: true };
    }
    console.warn(`  ⚠ Could not fetch ads: ${err.message}`);
    return { ads: [], blocked: false };
  }
}

// ── Formatting ─────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return "unknown";
  return iso.slice(0, 10);
}

function firstOf(arr) {
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

function renderAd(ad, index) {
  const headline = firstOf(ad.ad_creative_link_titles) || "";
  const body = firstOf(ad.ad_creative_bodies) || "";
  const description = firstOf(ad.ad_creative_link_descriptions) || "";
  const caption = firstOf(ad.ad_creative_link_captions) || "";
  const platforms = (ad.publisher_platforms || []).join(", ") || "unknown";
  const startDate = formatDate(ad.ad_delivery_start_time);
  const stopDate = ad.ad_delivery_stop_time
    ? formatDate(ad.ad_delivery_stop_time)
    : "active";
  const snapshotUrl = ad.ad_snapshot_url || "";

  let out = `#### Ad ${index + 1} — ${ad.page_name || "Unknown Page"}\n`;
  out += `Platforms: ${platforms} | Running: ${startDate} → ${stopDate}\n`;
  if (headline) out += `**Headline:** ${headline}\n`;
  if (body) out += `**Body:** ${body}\n`;
  if (description) out += `**Description:** ${description}\n`;
  if (caption) out += `**Caption/CTA:** ${caption}\n`;
  if (snapshotUrl) out += `[View Ad](${snapshotUrl})\n`;
  return out;
}

function renderSection(title, ads, blocked) {
  if (blocked) {
    return (
      `### ${title}\n` +
      `_⚠ API access blocked — Meta app requires Business Tools Terms acceptance and Live mode._\n` +
      `_To unlock: developers.facebook.com → your app → Business Tools Terms → request access._\n`
    );
  }
  if (ads.length === 0) {
    return `### ${title}\n_No active ads found._\n`;
  }
  let out = `### ${title}\n_${ads.length} ads found_\n\n`;
  out += ads.map((ad, i) => renderAd(ad, i)).join("\n---\n\n");
  out += "\n";
  return out;
}

// ── Main ───────────────────────────────────────────────────────────────────

async function syncAdsLibrary() {
  console.log("🔍 Syncing Meta Ads Library...");

  fs.mkdirSync(CONTEXT_DIR, { recursive: true });

  const outPath = path.join(CONTEXT_DIR, "ads-library.md");
  const syncDate = new Date().toISOString().slice(0, 10);

  // Preserve any manually-curated entries that were added via /save_ad or directly
  let manualSection = "";
  if (fs.existsSync(outPath)) {
    const existing = fs.readFileSync(outPath, "utf8");
    const manualStart = existing.indexOf("## Manual Entries");
    if (manualStart !== -1) {
      manualSection = existing.slice(manualStart);
    }
  }

  const sections = [];
  let anyBlocked = false;

  // By search term
  for (const term of SEARCH_TERMS) {
    console.log(`  Fetching ads for term: "${term}"`);
    const { ads, blocked } = await fetchAds({ searchTerm: term });
    if (blocked) {
      anyBlocked = true;
      console.warn(
        `  ⚠ API blocked for "${term}" — app needs Meta Business Tools Terms + Live mode.\n` +
        `    → developers.facebook.com → your app → Business Tools Terms`
      );
    }
    console.log(`  → ${ads.length} ads`);
    sections.push(renderSection(`Search: "${term}"`, ads, blocked));
  }

  // By competitor page ID
  for (const pageId of COMPETITOR_PAGE_IDS) {
    console.log(`  Fetching ads for page: ${pageId}`);
    const { ads, blocked } = await fetchAds({ pageId });
    if (blocked) {
      anyBlocked = true;
      console.warn(
        `  ⚠ API blocked for page ${pageId} — app needs Meta Business Tools Terms + Live mode.\n` +
        `    → developers.facebook.com → your app → Business Tools Terms`
      );
    }
    const pageName = ads.length > 0 ? ads[0].page_name || pageId : pageId;
    console.log(`  → ${ads.length} ads from ${pageName}`);
    sections.push(renderSection(`Competitor Page: ${pageName} (${pageId})`, ads, blocked));
  }

  // Assemble markdown — API results + preserved manual entries
  const parts = [
    `# Meta Ads Library — Competitor & Inspiration Ads`,
    `_Last synced: ${syncDate} | Country: ${COUNTRY} | ${LIMIT} ads per query_`,
    "",
    sections.join("\n---\n\n"),
  ];

  if (manualSection) {
    parts.push("\n---\n\n" + manualSection);
  } else if (anyBlocked) {
    parts.push(
      "\n---\n\n## Manual Entries",
      "_Use /save_ad in the Telegram bot to add competitor ads manually._",
      "_Example: /save_ad Brand Name — Headline — Body copy — platform, format, notes_\n"
    );
  }

  fs.writeFileSync(outPath, parts.join("\n"));
  console.log(`✅ Saved → context/meta/ads-library.md`);
}

syncAdsLibrary().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
