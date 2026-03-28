#!/usr/bin/env node
/**
 * google-setup.js — OAuth2 setup wizard for Google Workspace integration.
 *
 * Generates a GOOGLE_REFRESH_TOKEN with all required scopes:
 *   - Google Drive (read/write)
 *   - Google Calendar (read/write)
 *   - Gmail (read + send)
 *   - Google Business Profile / My Business (reviews)
 *
 * Usage:
 *   node scripts/google-setup.js
 *
 * Prerequisites:
 *   1. Go to console.cloud.google.com → your project
 *   2. Enable: Drive API, Calendar API, Gmail API, My Business Account Management API
 *   3. Under "OAuth consent screen" → add your Google account as a test user
 *   4. Under "Credentials" → OAuth 2.0 Client IDs → Web application
 *      Add redirect URI: http://localhost:3999/oauth2callback
 *   5. Copy Client ID and Client Secret into .env as GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 *
 * The generated GOOGLE_REFRESH_TOKEN will be appended to your .env file.
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { loadEnv } = require("./google-auth");

loadEnv();

const PORT = 3999;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/calendar",
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/business.manage",
  "openid",
  "email",
  "profile",
].join(" ");

function getCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_ADS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("\n❌ Missing credentials. Add to .env:\n");
    console.error("  GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com");
    console.error("  GOOGLE_CLIENT_SECRET=your-client-secret\n");
    console.error("Get these from: console.cloud.google.com → Credentials → OAuth 2.0 Client IDs");
    console.error("Make sure to add redirect URI: http://localhost:3999/oauth2callback\n");
    process.exit(1);
  }

  return { clientId, clientSecret };
}

function buildAuthUrl(clientId) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent", // force refresh token generation
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function exchangeCode(code, clientId, clientSecret) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
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
            reject(new Error(`Token exchange failed ${res.statusCode}: ${data}`));
          } else {
            resolve(JSON.parse(data));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function saveToEnv(key, value) {
  const envPath = path.resolve(__dirname, "..", ".env");
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  const regex = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;

  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    content += `\n${line}\n`;
  }

  fs.writeFileSync(envPath, content);
}

async function main() {
  const { clientId, clientSecret } = getCredentials();
  const authUrl = buildAuthUrl(clientId);

  console.log("\n🔐 Google Workspace OAuth Setup\n");
  console.log("This will authorize access to:");
  console.log("  • Google Drive — upload/download assets and reports");
  console.log("  • Google Calendar — read/write content calendar");
  console.log("  • Gmail — read inbox, send reports");
  console.log("  • Google Business Profile — fetch customer reviews\n");
  console.log("Opening your browser...\n");
  console.log(`If it doesn't open, visit:\n${authUrl}\n`);

  // Try to open browser
  try {
    const platform = process.platform;
    if (platform === "darwin") execSync(`open "${authUrl}"`);
    else if (platform === "win32") execSync(`start "" "${authUrl}"`);
    else execSync(`xdg-open "${authUrl}"`);
  } catch (e) {
    // Browser open failed — user will visit URL manually
  }

  // Start local server to capture the OAuth callback
  await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url.startsWith("/oauth2callback")) return;

      const url = new URL(`http://localhost:${PORT}${req.url}`);
      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(`<h1>❌ Authorization denied: ${error}</h1><p>Close this tab.</p>`);
        server.close();
        reject(new Error(`Authorization denied: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<h1>❌ No authorization code received</h1><p>Close this tab and try again.</p>");
        server.close();
        reject(new Error("No authorization code"));
        return;
      }

      try {
        console.log("✅ Authorization code received. Exchanging for tokens...\n");
        const tokens = await exchangeCode(code, clientId, clientSecret);

        if (!tokens.refresh_token) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h1>⚠️ No refresh token received</h1><p>This can happen if the app was already authorized. Revoke access at myaccount.google.com/permissions and try again.</p>");
          server.close();
          reject(new Error("No refresh_token in response. Revoke app access at myaccount.google.com/permissions and re-run."));
          return;
        }

        // Save to .env
        saveToEnv("GOOGLE_REFRESH_TOKEN", tokens.refresh_token);

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html><body style="font-family:sans-serif;padding:40px;max-width:500px">
          <h1>✅ Google Workspace Connected!</h1>
          <p>Your refresh token has been saved to <code>.env</code> as <strong>GOOGLE_REFRESH_TOKEN</strong>.</p>
          <p>You can now close this tab and use:</p>
          <ul>
            <li><code>npm run google:drive</code></li>
            <li><code>npm run google:calendar</code></li>
            <li><code>npm run google:mail</code></li>
            <li><code>npm run google:reviews</code></li>
          </ul>
          </body></html>
        `);

        console.log("✅ GOOGLE_REFRESH_TOKEN saved to .env\n");
        console.log("You can now run:");
        console.log("  npm run google:drive -- --list");
        console.log("  npm run google:calendar -- --list");
        console.log("  npm run google:mail -- --list");
        console.log("  npm run google:reviews -- --sync\n");

        server.close();
        resolve();
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(`<h1>❌ Error</h1><pre>${err.message}</pre>`);
        server.close();
        reject(err);
      }
    });

    server.listen(PORT, () => {
      console.log(`Waiting for Google callback on http://localhost:${PORT}...`);
    });

    server.on("error", reject);
  });
}

main().catch((err) => {
  console.error(`\n❌ Setup failed: ${err.message}\n`);
  process.exit(1);
});
