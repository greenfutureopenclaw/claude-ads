#!/usr/bin/env node

/**
 * Meta API Connection Test — Verifies token and fetches Page + Instagram info.
 *
 * Usage:
 *   node shopify/meta-test.js
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

if (!ACCESS_TOKEN) {
  console.error("Missing META_ACCESS_TOKEN in .env");
  process.exit(1);
}

const API_VERSION = "v21.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

function graphGet(endpoint) {
  return new Promise((resolve, reject) => {
    const sep = endpoint.includes("?") ? "&" : "?";
    const url = `${BASE_URL}${endpoint}${sep}access_token=${ACCESS_TOKEN}`;

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

async function main() {
  console.log("=== Meta API Connection Test ===\n");

  // 1. Test token with /me
  try {
    console.log("1. Testing access token...");
    const me = await graphGet("/me?fields=id,name");
    console.log(`   ✓ Token valid — User: ${me.name} (ID: ${me.id})\n`);
  } catch (err) {
    console.error(`   ✗ Token INVALID — ${err.message}\n`);
    process.exit(1);
  }

  // 2. Test Page access
  if (PAGE_ID) {
    try {
      console.log(`2. Fetching Facebook Page (${PAGE_ID})...`);
      const page = await graphGet(`/${PAGE_ID}?fields=name,followers_count,fan_count`);
      console.log(`   ✓ Page: ${page.name}`);
      console.log(`   Followers: ${page.followers_count || "N/A"}`);
      console.log(`   Fans: ${page.fan_count || "N/A"}\n`);
    } catch (err) {
      console.error(`   ✗ Page fetch failed — ${err.message}\n`);
    }
  } else {
    console.log("2. Skipping Page test (no META_PAGE_ID in .env)\n");
  }

  // 3. Test Instagram access
  if (INSTAGRAM_ID) {
    try {
      console.log(`3. Fetching Instagram account (${INSTAGRAM_ID})...`);
      const ig = await graphGet(`/${INSTAGRAM_ID}?fields=username,followers_count,media_count`);
      console.log(`   ✓ Instagram: @${ig.username}`);
      console.log(`   Followers: ${ig.followers_count || "N/A"}`);
      console.log(`   Media count: ${ig.media_count || "N/A"}\n`);
    } catch (err) {
      console.error(`   ✗ Instagram fetch failed — ${err.message}\n`);
    }
  } else {
    console.log("3. Skipping Instagram test (no META_INSTAGRAM_ID in .env)\n");
  }

  // 4. Test token permissions
  try {
    console.log("4. Checking token permissions...");
    const perms = await graphGet("/me/permissions");
    const granted = (perms.data || [])
      .filter((p) => p.status === "granted")
      .map((p) => p.permission);
    console.log(`   Granted: ${granted.join(", ")}\n`);
  } catch (err) {
    console.error(`   Could not fetch permissions — ${err.message}\n`);
  }

  console.log("=== Connection test complete ===");
}

main();
