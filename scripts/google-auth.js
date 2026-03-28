#!/usr/bin/env node
/**
 * google-auth.js — Shared OAuth2 helper for all Google Workspace scripts.
 *
 * Reads from .env:
 *   GOOGLE_CLIENT_ID        (can reuse GOOGLE_ADS_CLIENT_ID)
 *   GOOGLE_CLIENT_SECRET    (can reuse GOOGLE_ADS_CLIENT_SECRET)
 *   GOOGLE_REFRESH_TOKEN    (workspace scopes — run google-setup.js to generate)
 *
 * Run `node scripts/google-setup.js` to generate GOOGLE_REFRESH_TOKEN.
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// Load .env once
function loadEnv() {
  const envPath = path.resolve(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const val = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

/**
 * Get a fresh Google access token using the stored refresh token.
 * @param {object} [override] - Optional credential overrides
 * @returns {Promise<string>} access_token
 */
async function getAccessToken(override = {}) {
  const clientId = override.clientId || process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = override.clientSecret || process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = override.refreshToken || process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    const missing = [];
    if (!clientId) missing.push("GOOGLE_CLIENT_ID");
    if (!clientSecret) missing.push("GOOGLE_CLIENT_SECRET");
    if (!refreshToken) missing.push("GOOGLE_REFRESH_TOKEN");
    throw new Error(
      `Missing credentials: ${missing.join(", ")}\n` +
      `Run: node scripts/google-setup.js`
    );
  }

  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString();

    const req = https.request(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`OAuth token error ${res.statusCode}: ${data.slice(0, 300)}`));
          } else {
            const parsed = JSON.parse(data);
            if (!parsed.access_token) {
              reject(new Error(`No access_token in response: ${data.slice(0, 200)}`));
            } else {
              resolve(parsed.access_token);
            }
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Make an authenticated Google API request.
 * @param {string} method
 * @param {string} url - Full URL including query params
 * @param {object} [body] - JSON body (for POST/PATCH/PUT)
 * @param {string} accessToken
 * @returns {Promise<object>}
 */
async function googleRequest(method, url, body, accessToken) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const urlObj = new URL(url);

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Google API ${res.statusCode} ${method} ${url.slice(0, 80)}: ${data.slice(0, 400)}`));
        } else {
          resolve(data ? JSON.parse(data) : {});
        }
      });
    });
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = { getAccessToken, googleRequest, loadEnv };
