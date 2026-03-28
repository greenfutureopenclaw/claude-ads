#!/usr/bin/env node

/**
 * TikTok Ads Sync — Pulls ad performance data into context files
 * for use by /report-writer, /performance-brief, and /fatigue-detector.
 *
 * Usage:
 *   node shopify/tiktok-sync.js [--campaigns] [--ads] [--all]
 *
 * Requires .env with:
 *   TIKTOK_ACCESS_TOKEN=xxxxx
 *   TIKTOK_ADVERTISER_ID=xxxxx
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

const ACCESS_TOKEN = process.env.TIKTOK_ACCESS_TOKEN;
const ADVERTISER_ID = process.env.TIKTOK_ADVERTISER_ID;
const CONTEXT_DIR = path.resolve(__dirname, "..", "context", "tiktok-ads");

if (!ACCESS_TOKEN || !ADVERTISER_ID) {
  console.error(
    "Missing TikTok Ads credentials in .env. Required:\n" +
    "  TIKTOK_ACCESS_TOKEN\n" +
    "  TIKTOK_ADVERTISER_ID\n\n" +
    "Get these from TikTok Business Center > Assets > Developer Portal"
  );
  process.exit(1);
}

function tiktokGet(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    params.advertiser_id = ADVERTISER_ID;
    const query = new URLSearchParams(params).toString();
    const url = `https://business-api.tiktok.com/open_api/v1.3/${endpoint}?${query}`;

    const req = https.request(
      url,
      {
        headers: {
          "Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`TikTok API ${res.statusCode}: ${data.slice(0, 300)}`));
          } else {
            const parsed = JSON.parse(data);
            if (parsed.code !== 0) {
              reject(new Error(`TikTok API error ${parsed.code}: ${parsed.message}`));
            } else {
              resolve(parsed.data);
            }
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function tiktokPost(endpoint, body = {}) {
  return new Promise((resolve, reject) => {
    body.advertiser_id = ADVERTISER_ID;
    const postData = JSON.stringify(body);

    const req = https.request(
      `https://business-api.tiktok.com/open_api/v1.3/${endpoint}`,
      {
        method: "POST",
        headers: {
          "Access-Token": ACCESS_TOKEN,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`TikTok API ${res.statusCode}: ${data.slice(0, 300)}`));
          } else {
            const parsed = JSON.parse(data);
            if (parsed.code !== 0) {
              reject(new Error(`TikTok API error ${parsed.code}: ${parsed.message}`));
            } else {
              resolve(parsed.data);
            }
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function syncCampaigns() {
  console.log("Fetching TikTok campaign performance (last 30 days)...");

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const data = await tiktokPost("report/integrated/get/", {
    report_type: "BASIC",
    data_level: "AUCTION_CAMPAIGN",
    dimensions: ["campaign_id"],
    metrics: [
      "campaign_name", "spend", "impressions", "clicks", "ctr",
      "conversion", "cost_per_conversion", "conversion_rate",
      "total_complete_payment_rate", "total_onweb_shopping_value"
    ],
    start_date: startDate,
    end_date: endDate,
    page_size: 100,
  });

  const rows = (data.list || []).map((item) => {
    const m = item.metrics || {};
    return {
      campaign_id: item.dimensions?.campaign_id,
      name: m.campaign_name || "Unknown",
      spend: parseFloat(m.spend || 0).toFixed(2),
      impressions: parseInt(m.impressions || 0),
      clicks: parseInt(m.clicks || 0),
      ctr: parseFloat(m.ctr || 0).toFixed(2),
      conversions: parseFloat(m.conversion || 0).toFixed(1),
      cpa: parseFloat(m.cost_per_conversion || 0).toFixed(2),
      cvr: parseFloat(m.conversion_rate || 0).toFixed(2),
      revenue: parseFloat(m.total_onweb_shopping_value || 0).toFixed(2),
    };
  });

  // Save JSON
  fs.writeFileSync(
    path.join(CONTEXT_DIR, "campaigns.json"),
    JSON.stringify(rows, null, 2)
  );

  // Save markdown
  const totalSpend = rows.reduce((s, r) => s + parseFloat(r.spend), 0);
  const totalRevenue = rows.reduce((s, r) => s + parseFloat(r.revenue), 0);
  const totalConversions = rows.reduce((s, r) => s + parseFloat(r.conversions), 0);

  let md = `# TikTok Ads — Campaign Performance\n\n`;
  md += `**Synced:** ${new Date().toISOString().split("T")[0]}\n`;
  md += `**Period:** ${startDate} to ${endDate}\n`;
  md += `**Campaigns:** ${rows.length}\n\n`;
  md += `## Summary\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total Spend | $${totalSpend.toFixed(2)} |\n`;
  md += `| Total Revenue | $${totalRevenue.toFixed(2)} |\n`;
  md += `| ROAS | ${totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : "N/A"}x |\n`;
  md += `| Total Conversions | ${totalConversions.toFixed(0)} |\n`;
  md += `| Avg CPA | $${totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : "N/A"} |\n\n`;

  md += `## Campaign Breakdown\n\n`;
  md += `| Campaign | Spend | Revenue | ROAS | Conv. | CTR | CPA |\n`;
  md += `|----------|-------|---------|------|-------|-----|-----|\n`;
  for (const r of rows) {
    const roas = parseFloat(r.spend) > 0 ? (parseFloat(r.revenue) / parseFloat(r.spend)).toFixed(2) : "—";
    md += `| ${r.name} | $${r.spend} | $${r.revenue} | ${roas}x | ${r.conversions} | ${r.ctr}% | $${r.cpa} |\n`;
  }

  fs.writeFileSync(path.join(CONTEXT_DIR, "performance.md"), md);
  console.log(`  Synced ${rows.length} campaigns`);
}

async function syncAds() {
  console.log("Fetching TikTok ad-level performance (last 14 days)...");

  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const data = await tiktokPost("report/integrated/get/", {
    report_type: "BASIC",
    data_level: "AUCTION_AD",
    dimensions: ["ad_id"],
    metrics: [
      "ad_name", "campaign_name", "spend", "impressions", "clicks",
      "ctr", "conversion", "cost_per_conversion", "conversion_rate",
      "total_onweb_shopping_value", "frequency", "video_play_actions",
      "video_watched_2s", "video_watched_6s", "average_video_play_per_user"
    ],
    start_date: startDate,
    end_date: endDate,
    page_size: 100,
  });

  const rows = (data.list || []).map((item) => {
    const m = item.metrics || {};
    return {
      ad_id: item.dimensions?.ad_id,
      name: m.ad_name || "Unknown",
      campaign: m.campaign_name || "Unknown",
      spend: parseFloat(m.spend || 0).toFixed(2),
      impressions: parseInt(m.impressions || 0),
      clicks: parseInt(m.clicks || 0),
      ctr: parseFloat(m.ctr || 0).toFixed(2),
      conversions: parseFloat(m.conversion || 0).toFixed(1),
      cpa: parseFloat(m.cost_per_conversion || 0).toFixed(2),
      revenue: parseFloat(m.total_onweb_shopping_value || 0).toFixed(2),
      frequency: parseFloat(m.frequency || 0).toFixed(1),
      video_plays: parseInt(m.video_play_actions || 0),
      watched_2s: parseInt(m.video_watched_2s || 0),
      watched_6s: parseInt(m.video_watched_6s || 0),
    };
  });

  fs.writeFileSync(
    path.join(CONTEXT_DIR, "ads.json"),
    JSON.stringify(rows, null, 2)
  );

  // Append ad-level data to performance.md
  let md = `\n## Top Ads (Last 14 Days)\n\n`;
  md += `| Ad | Campaign | Spend | Revenue | ROAS | CTR | Freq. | 2s Views |\n`;
  md += `|----|----------|-------|---------|------|-----|-------|----------|\n`;

  const sorted = rows.sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue));
  for (const r of sorted.slice(0, 20)) {
    const roas = parseFloat(r.spend) > 0 ? (parseFloat(r.revenue) / parseFloat(r.spend)).toFixed(2) : "—";
    const viewRate = r.impressions > 0 ? ((r.watched_2s / r.impressions) * 100).toFixed(1) : "—";
    md += `| ${r.name} | ${r.campaign} | $${r.spend} | $${r.revenue} | ${roas}x | ${r.ctr}% | ${r.frequency} | ${viewRate}% |\n`;
  }

  const existing = fs.readFileSync(path.join(CONTEXT_DIR, "performance.md"), "utf8");
  fs.writeFileSync(path.join(CONTEXT_DIR, "performance.md"), existing + md);
  console.log(`  Synced ${rows.length} ads`);
}

async function main() {
  const args = process.argv.slice(2);
  const syncAll = args.includes("--all") || args.length === 0;
  const doCampaigns = syncAll || args.includes("--campaigns");
  const doAds = syncAll || args.includes("--ads");

  if (!fs.existsSync(CONTEXT_DIR)) {
    fs.mkdirSync(CONTEXT_DIR, { recursive: true });
  }

  console.log(`Syncing TikTok Ads for advertiser ${ADVERTISER_ID}...\n`);

  try {
    if (doCampaigns) await syncCampaigns();
    if (doAds) await syncAds();
    console.log("\nSync complete! Files saved to context/tiktok-ads/");
  } catch (err) {
    console.error(`\nSync failed: ${err.message}`);
    process.exit(1);
  }
}

main();
