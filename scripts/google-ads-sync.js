#!/usr/bin/env node

/**
 * Google Ads Sync — Pulls campaign and ad group performance data
 * into context files for use by /report-writer and /performance-brief.
 *
 * Usage:
 *   node shopify/google-ads-sync.js [--campaigns] [--adgroups] [--all]
 *
 * Requires .env with:
 *   GOOGLE_ADS_DEVELOPER_TOKEN=xxxxx
 *   GOOGLE_ADS_CLIENT_ID=xxxxx.apps.googleusercontent.com
 *   GOOGLE_ADS_CLIENT_SECRET=xxxxx
 *   GOOGLE_ADS_REFRESH_TOKEN=xxxxx
 *   GOOGLE_ADS_CUSTOMER_ID=1234567890 (no dashes)
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

const DEV_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;
const CONTEXT_DIR = path.resolve(__dirname, "..", "context", "google-ads");

if (!DEV_TOKEN || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !CUSTOMER_ID) {
  console.error(
    "Missing Google Ads credentials in .env. Required:\n" +
    "  GOOGLE_ADS_DEVELOPER_TOKEN\n" +
    "  GOOGLE_ADS_CLIENT_ID\n" +
    "  GOOGLE_ADS_CLIENT_SECRET\n" +
    "  GOOGLE_ADS_REFRESH_TOKEN\n" +
    "  GOOGLE_ADS_CUSTOMER_ID"
  );
  process.exit(1);
}

async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: "refresh_token",
    }).toString();

    const req = https.request(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`OAuth error ${res.statusCode}: ${data.slice(0, 200)}`));
          } else {
            resolve(JSON.parse(data).access_token);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function googleAdsQuery(accessToken, query) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });
    const customerId = CUSTOMER_ID.replace(/-/g, "");

    const req = https.request(
      `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": DEV_TOKEN,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`Google Ads API ${res.statusCode}: ${data.slice(0, 300)}`));
          } else {
            resolve(JSON.parse(data));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function syncCampaigns(accessToken) {
  console.log("Fetching campaign performance (last 30 days)...");

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      metrics.cost_per_conversion
    FROM campaign
    WHERE segments.date DURING LAST_30_DAYS
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
  `;

  const response = await googleAdsQuery(accessToken, query);
  const rows = [];

  for (const batch of response) {
    for (const result of batch.results || []) {
      rows.push({
        campaign_id: result.campaign?.id,
        name: result.campaign?.name,
        status: result.campaign?.status,
        channel: result.campaign?.advertisingChannelType,
        impressions: parseInt(result.metrics?.impressions || 0),
        clicks: parseInt(result.metrics?.clicks || 0),
        spend: (parseInt(result.metrics?.costMicros || 0) / 1000000).toFixed(2),
        conversions: parseFloat(result.metrics?.conversions || 0).toFixed(1),
        revenue: parseFloat(result.metrics?.conversionsValue || 0).toFixed(2),
        ctr: (parseFloat(result.metrics?.ctr || 0) * 100).toFixed(2),
        avg_cpc: (parseInt(result.metrics?.averageCpc || 0) / 1000000).toFixed(2),
        cpa: (parseInt(result.metrics?.costPerConversion || 0) / 1000000).toFixed(2),
      });
    }
  }

  // Save JSON
  fs.writeFileSync(
    path.join(CONTEXT_DIR, "campaigns.json"),
    JSON.stringify(rows, null, 2)
  );

  // Save markdown
  const totalSpend = rows.reduce((s, r) => s + parseFloat(r.spend), 0);
  const totalRevenue = rows.reduce((s, r) => s + parseFloat(r.revenue), 0);
  const totalConversions = rows.reduce((s, r) => s + parseFloat(r.conversions), 0);

  let md = `# Google Ads — Campaign Performance\n\n`;
  md += `**Synced:** ${new Date().toISOString().split("T")[0]}\n`;
  md += `**Period:** Last 30 days\n`;
  md += `**Campaigns:** ${rows.length}\n\n`;
  md += `## Summary\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total Spend | $${totalSpend.toFixed(2)} |\n`;
  md += `| Total Revenue | $${totalRevenue.toFixed(2)} |\n`;
  md += `| ROAS | ${totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : "N/A"}x |\n`;
  md += `| Total Conversions | ${totalConversions.toFixed(0)} |\n\n`;

  md += `## Campaign Breakdown\n\n`;
  md += `| Campaign | Status | Spend | Revenue | ROAS | Conv. | CTR | CPA |\n`;
  md += `|----------|--------|-------|---------|------|-------|-----|-----|\n`;
  for (const r of rows) {
    const roas = parseFloat(r.spend) > 0 ? (parseFloat(r.revenue) / parseFloat(r.spend)).toFixed(2) : "—";
    md += `| ${r.name} | ${r.status} | $${r.spend} | $${r.revenue} | ${roas}x | ${r.conversions} | ${r.ctr}% | $${r.cpa} |\n`;
  }

  fs.writeFileSync(path.join(CONTEXT_DIR, "performance.md"), md);
  console.log(`  Synced ${rows.length} campaigns`);
}

async function syncAdGroups(accessToken) {
  console.log("Fetching ad group performance (last 14 days)...");

  const query = `
    SELECT
      ad_group.id,
      ad_group.name,
      ad_group.status,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc
    FROM ad_group
    WHERE segments.date DURING LAST_14_DAYS
      AND ad_group.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `;

  const response = await googleAdsQuery(accessToken, query);
  const rows = [];

  for (const batch of response) {
    for (const result of batch.results || []) {
      rows.push({
        ad_group_id: result.adGroup?.id,
        name: result.adGroup?.name,
        campaign: result.campaign?.name,
        status: result.adGroup?.status,
        impressions: parseInt(result.metrics?.impressions || 0),
        clicks: parseInt(result.metrics?.clicks || 0),
        spend: (parseInt(result.metrics?.costMicros || 0) / 1000000).toFixed(2),
        conversions: parseFloat(result.metrics?.conversions || 0).toFixed(1),
        revenue: parseFloat(result.metrics?.conversionsValue || 0).toFixed(2),
        ctr: (parseFloat(result.metrics?.ctr || 0) * 100).toFixed(2),
      });
    }
  }

  fs.writeFileSync(
    path.join(CONTEXT_DIR, "adgroups.json"),
    JSON.stringify(rows, null, 2)
  );

  let md = `\n## Top Ad Groups (Last 14 Days)\n\n`;
  md += `| Ad Group | Campaign | Spend | Revenue | Conv. | CTR |\n`;
  md += `|----------|----------|-------|---------|-------|-----|\n`;
  for (const r of rows.slice(0, 20)) {
    md += `| ${r.name} | ${r.campaign} | $${r.spend} | $${r.revenue} | ${r.conversions} | ${r.ctr}% |\n`;
  }

  // Append to performance.md
  const existing = fs.readFileSync(path.join(CONTEXT_DIR, "performance.md"), "utf8");
  fs.writeFileSync(path.join(CONTEXT_DIR, "performance.md"), existing + md);
  console.log(`  Synced ${rows.length} ad groups`);
}

async function main() {
  const args = process.argv.slice(2);
  const syncAll = args.includes("--all") || args.length === 0;
  const doCampaigns = syncAll || args.includes("--campaigns");
  const doAdGroups = syncAll || args.includes("--adgroups");

  if (!fs.existsSync(CONTEXT_DIR)) {
    fs.mkdirSync(CONTEXT_DIR, { recursive: true });
  }

  console.log("Authenticating with Google Ads...\n");

  try {
    const accessToken = await getAccessToken();
    if (doCampaigns) await syncCampaigns(accessToken);
    if (doAdGroups) await syncAdGroups(accessToken);
    console.log("\nSync complete! Files saved to context/google-ads/");
  } catch (err) {
    console.error(`\nSync failed: ${err.message}`);
    process.exit(1);
  }
}

main();
