#!/usr/bin/env node

/**
 * Meta Ads Sync — Pulls Facebook Page + Instagram performance data into context files
 * for use by /report-writer, /performance-brief, and /fatigue-detector.
 *
 * Usage:
 *   node shopify/meta-sync.js [--page] [--instagram] [--all]
 *
 * Requires .env with:
 *   META_ACCESS_TOKEN
 *   META_PAGE_ID
 *   META_INSTAGRAM_ID
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// Load .env
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const PAGE_ID = process.env.META_PAGE_ID;
const INSTAGRAM_ID = process.env.META_INSTAGRAM_ID;
const CONTEXT_DIR = path.resolve(__dirname, "..", "context", "meta");

if (!ACCESS_TOKEN) {
  console.error(
    "Missing Meta credentials in .env. Required:\n" +
    "  META_ACCESS_TOKEN\n" +
    "  META_PAGE_ID (optional)\n" +
    "  META_INSTAGRAM_ID (optional)\n\n" +
    "Get a Page Access Token from Meta Business Suite or Graph API Explorer."
  );
  process.exit(1);
}

if (!PAGE_ID && !INSTAGRAM_ID) {
  console.error("At least one of META_PAGE_ID or META_INSTAGRAM_ID is required in .env");
  process.exit(1);
}

const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

function graphGet(endpoint) {
  return new Promise((resolve, reject) => {
    // Support both relative endpoints and full URLs (for pagination cursors)
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${BASE_URL}${endpoint}${endpoint.includes("?") ? "&" : "?"}access_token=${ACCESS_TOKEN}`;

    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Graph API ${res.statusCode}: ${data.slice(0, 500)}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    }).on("error", reject);
  });
}

/**
 * Paginate through all results for an endpoint, following cursor pages.
 * Returns a flat array of all items across all pages.
 */
async function graphGetAll(endpoint, label = "items") {
  const all = [];
  let url = endpoint;
  let page = 1;

  while (url) {
    const result = await graphGet(url);
    const items = result.data || [];
    all.push(...items);
    process.stdout.write(`\r  → ${label}: ${all.length} fetched (page ${page})...`);
    // Follow cursor to next page, if any
    url = result.paging?.next || null;
    page++;
  }
  process.stdout.write(`\r  → ${label}: ${all.length} total fetched          \n`);
  return all;
}

async function syncPage() {
  if (!PAGE_ID) {
    console.log("Skipping Page sync (no META_PAGE_ID)");
    return null;
  }

  console.log("Fetching Facebook Page info and posts...");

  // Page info
  const page = await graphGet(`/${PAGE_ID}?fields=name,followers_count,fan_count,about`);

  // All posts via pagination (100 per page)
  const rawPosts = await graphGetAll(
    `/${PAGE_ID}/posts?fields=message,created_time,shares,reactions.summary(total_count),comments.summary(total_count)&limit=100`,
    "FB posts"
  );

  const posts = [];
  for (const post of rawPosts) {
    let impressions = 0, engaged_users = 0;
    try {
      const insightsData = await graphGet(
        `/${post.id}/insights?metric=post_impressions,post_engaged_users`
      );
      for (const metric of insightsData.data || []) {
        if (metric.name === "post_impressions") impressions = metric.values?.[0]?.value || 0;
        if (metric.name === "post_engaged_users") engaged_users = metric.values?.[0]?.value || 0;
      }
    } catch {
      // Insights not available for all post types
    }
    posts.push({
      id: post.id,
      message: (post.message || "").slice(0, 120),
      created_time: post.created_time,
      shares: post.shares?.count || 0,
      reactions: post.reactions?.summary?.total_count || 0,
      comments: post.comments?.summary?.total_count || 0,
      impressions,
      engaged_users,
    });
  }

  // Save JSON
  fs.writeFileSync(
    path.join(CONTEXT_DIR, "page-posts.json"),
    JSON.stringify({ page, posts }, null, 2)
  );

  console.log(`  Synced Page "${page.name}" — ${posts.length} total posts`);
  return { page, posts };
}

async function syncInstagram() {
  if (!INSTAGRAM_ID) {
    console.log("Skipping Instagram sync (no META_INSTAGRAM_ID)");
    return null;
  }

  console.log("Fetching Instagram account info and media...");

  // IG account info
  const igAccount = await graphGet(
    `/${INSTAGRAM_ID}?fields=username,followers_count,media_count,biography`
  );

  // All media via pagination (100 per page)
  const rawMedia = await graphGetAll(
    `/${INSTAGRAM_ID}/media?fields=caption,timestamp,like_count,comments_count,media_type,permalink&limit=100`,
    "IG posts"
  );

  const media = [];
  for (const item of rawMedia) {
    let insights = {};
    try {
      const insightsData = await graphGet(
        `/${item.id}/insights?metric=impressions,reach`
      );
      for (const metric of insightsData.data || []) {
        insights[metric.name] = metric.values?.[0]?.value || 0;
      }
    } catch {
      // Insights may not be available for all media types (e.g., stories)
    }

    media.push({
      id: item.id,
      caption: (item.caption || "").slice(0, 120),
      timestamp: item.timestamp,
      type: item.media_type,
      likes: item.like_count || 0,
      comments: item.comments_count || 0,
      impressions: insights.impressions || 0,
      reach: insights.reach || 0,
      permalink: item.permalink,
    });
  }

  // Save JSON
  fs.writeFileSync(
    path.join(CONTEXT_DIR, "ig-media.json"),
    JSON.stringify({ account: igAccount, media }, null, 2)
  );

  console.log(`  Synced @${igAccount.username} — ${media.length} total posts`);
  return { account: igAccount, media };
}

function buildPerformanceMarkdown(pageData, igData) {
  const today = new Date().toISOString().split("T")[0];
  let md = `# Meta — Performance Overview\n\n`;
  md += `**Synced:** ${today}\n\n`;

  // Facebook Page section
  if (pageData) {
    const { page, posts } = pageData;
    md += `## Facebook Page: ${page.name}\n\n`;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Followers | ${(page.followers_count || 0).toLocaleString()} |\n`;
    md += `| Fans | ${(page.fan_count || 0).toLocaleString()} |\n`;

    const totalImpressions = posts.reduce((s, p) => s + p.impressions, 0);
    const totalEngaged = posts.reduce((s, p) => s + p.engaged_users, 0);
    const totalClicks = posts.reduce((s, p) => s + p.clicks, 0);
    const totalShares = posts.reduce((s, p) => s + p.shares, 0);

    md += `| Total Posts Synced | ${posts.length.toLocaleString()} |\n`;
    md += `| Total Impressions (all posts) | ${totalImpressions.toLocaleString()} |\n`;
    md += `| Total Engaged Users | ${totalEngaged.toLocaleString()} |\n`;
    md += `| Total Clicks | ${totalClicks.toLocaleString()} |\n`;
    md += `| Total Shares | ${totalShares.toLocaleString()} |\n`;
    md += `| Avg Engagement Rate | ${totalImpressions > 0 ? ((totalEngaged / totalImpressions) * 100).toFixed(2) : "N/A"}% |\n\n`;

    md += `### Top Posts by Impressions (all-time)\n\n`;
    md += `| Date | Post | Impressions | Engaged | Clicks | Shares |\n`;
    md += `|------|------|-------------|---------|--------|--------|\n`;
    const sortedPosts = [...posts].sort((a, b) => b.impressions - a.impressions);
    for (const p of sortedPosts.slice(0, 50)) {
      const date = p.created_time ? p.created_time.split("T")[0] : "—";
      const msg = p.message.replace(/\n/g, " ").slice(0, 60) || "(no text)";
      md += `| ${date} | ${msg} | ${p.impressions} | ${p.engaged_users} | ${p.clicks} | ${p.shares} |\n`;
    }
    md += `\n`;
  }

  // Instagram section
  if (igData) {
    const { account, media } = igData;
    md += `## Instagram: @${account.username}\n\n`;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Followers | ${(account.followers_count || 0).toLocaleString()} |\n`;
    md += `| Media Count | ${(account.media_count || 0).toLocaleString()} |\n`;

    const totalLikes = media.reduce((s, m) => s + m.likes, 0);
    const totalComments = media.reduce((s, m) => s + m.comments, 0);
    const totalImpressions = media.reduce((s, m) => s + m.impressions, 0);
    const totalReach = media.reduce((s, m) => s + m.reach, 0);

    md += `| Total Posts Synced | ${media.length.toLocaleString()} |\n`;
    md += `| Total Likes (all posts) | ${totalLikes.toLocaleString()} |\n`;
    md += `| Total Comments | ${totalComments.toLocaleString()} |\n`;
    md += `| Total Impressions | ${totalImpressions.toLocaleString()} |\n`;
    md += `| Total Reach | ${totalReach.toLocaleString()} |\n`;
    md += `| Avg Engagement Rate | ${totalReach > 0 ? (((totalLikes + totalComments) / totalReach) * 100).toFixed(2) : "N/A"}% |\n\n`;

    md += `### Top Media by Reach (all-time)\n\n`;
    md += `| Date | Type | Caption | Likes | Comments | Impressions | Reach |\n`;
    md += `|------|------|---------|-------|----------|-------------|-------|\n`;
    const sortedMedia = [...media].sort((a, b) => b.reach - a.reach);
    for (const m of sortedMedia.slice(0, 50)) {
      const date = m.timestamp ? m.timestamp.split("T")[0] : "—";
      const caption = m.caption.replace(/\n/g, " ").slice(0, 50) || "(no caption)";
      md += `| ${date} | ${m.type} | ${caption} | ${m.likes} | ${m.comments} | ${m.impressions} | ${m.reach} |\n`;
    }
    md += `\n`;
  }

  return md;
}

async function main() {
  const args = process.argv.slice(2);
  const syncAll = args.includes("--all") || args.length === 0;
  const doPage = syncAll || args.includes("--page");
  const doInstagram = syncAll || args.includes("--instagram");

  if (!fs.existsSync(CONTEXT_DIR)) {
    fs.mkdirSync(CONTEXT_DIR, { recursive: true });
  }

  console.log(`Syncing Meta data...\n`);

  try {
    const pageData = doPage ? await syncPage() : null;
    const igData = doInstagram ? await syncInstagram() : null;

    const md = buildPerformanceMarkdown(pageData, igData);
    fs.writeFileSync(path.join(CONTEXT_DIR, "performance.md"), md);

    console.log("\nSync complete! Files saved to context/meta/");
  } catch (err) {
    console.error(`\nSync failed: ${err.message}`);
    process.exit(1);
  }
}

main();
