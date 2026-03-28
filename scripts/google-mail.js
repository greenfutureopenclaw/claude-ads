#!/usr/bin/env node
/**
 * google-mail.js — Gmail integration for sending reports and reading inbox.
 *
 * Usage:
 *   node scripts/google-mail.js --list [--count 10]
 *   node scripts/google-mail.js --read <messageId>
 *   node scripts/google-mail.js --send --to "email@example.com" --subject "..." --body "..."
 *   node scripts/google-mail.js --send-report <filepath> --to "email@example.com"
 *   node scripts/google-mail.js --search <query>
 *
 * Requires .env:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *   GOOGLE_MAIL_DEFAULT_TO  (optional: default recipient for reports)
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { getAccessToken } = require("./google-auth");

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const DEFAULT_TO = process.env.GOOGLE_MAIL_DEFAULT_TO || "";

// ── Helpers ──────────────────────────────────────────────────────────────────

function gmailRequest(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`Gmail API ${res.statusCode}: ${data.slice(0, 300)}`));
          } else {
            resolve(data ? JSON.parse(data) : {});
          }
        });
      }
    );
    req.on("error", reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function decodeBase64(str) {
  try {
    return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return str;
  }
}

function encodeBase64Url(str) {
  return Buffer.from(str).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getHeader(headers, name) {
  return headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function extractBody(payload) {
  if (payload.body?.data) return decodeBase64(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.body?.data) return decodeBase64(part.body.data);
    }
  }
  return "(no body)";
}

function buildRawEmail({ to, from, subject, body, isHtml = false }) {
  const contentType = isHtml ? "text/html" : "text/plain";
  const email = [
    `To: ${to}`,
    `From: ${from}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: ${contentType}; charset=UTF-8`,
    ``,
    body,
  ].join("\r\n");
  return encodeBase64Url(email);
}

// ── Operations ────────────────────────────────────────────────────────────────

async function listMessages(token, count = 10) {
  const result = await gmailRequest("GET", `${BASE}/messages?maxResults=${count}&labelIds=INBOX`, null, token);
  const messages = result.messages || [];
  if (messages.length === 0) { console.log("(inbox empty)"); return; }

  console.log(`\n📬 Recent inbox messages:\n`);
  for (const msg of messages.slice(0, count)) {
    const full = await gmailRequest("GET", `${BASE}/messages/${msg.id}?format=metadata&metadataHeaders=From,Subject,Date`, null, token);
    const from = getHeader(full.payload?.headers, "from");
    const subject = getHeader(full.payload?.headers, "subject");
    const date = getHeader(full.payload?.headers, "date");
    const snippet = full.snippet || "";
    console.log(`  📧 ${subject}`);
    console.log(`     From: ${from}`);
    console.log(`     Date: ${date}`);
    console.log(`     ${snippet.slice(0, 100)}${snippet.length > 100 ? "..." : ""}`);
    console.log(`     ID: ${msg.id}`);
    console.log();
  }
}

async function readMessage(token, messageId) {
  const msg = await gmailRequest("GET", `${BASE}/messages/${messageId}?format=full`, null, token);
  const headers = msg.payload?.headers || [];
  const from = getHeader(headers, "from");
  const to = getHeader(headers, "to");
  const subject = getHeader(headers, "subject");
  const date = getHeader(headers, "date");
  const body = extractBody(msg.payload || {});

  console.log(`\n📧 ${subject}`);
  console.log(`From: ${from}`);
  console.log(`To: ${to}`);
  console.log(`Date: ${date}`);
  console.log(`\n${"─".repeat(60)}\n`);
  console.log(body);
}

async function searchMessages(token, query, count = 10) {
  const result = await gmailRequest("GET", `${BASE}/messages?` + new URLSearchParams({ q: query, maxResults: count }), null, token);
  const messages = result.messages || [];
  if (messages.length === 0) { console.log(`(no results for "${query}")`); return; }

  console.log(`\n🔍 Search results for "${query}":\n`);
  for (const msg of messages) {
    const full = await gmailRequest("GET", `${BASE}/messages/${msg.id}?format=metadata&metadataHeaders=From,Subject,Date`, null, token);
    const from = getHeader(full.payload?.headers, "from");
    const subject = getHeader(full.payload?.headers, "subject");
    console.log(`  📧 ${subject}`);
    console.log(`     From: ${from}  |  ID: ${msg.id}`);
    console.log();
  }
}

async function getMyEmail(token) {
  const profile = await gmailRequest("GET", `${BASE.replace("/users/me", "/users/me")}/profile`, null, token);
  return profile.emailAddress || "";
}

async function sendMessage(token, { to, subject, body, isHtml = false }) {
  if (!to || !subject || !body) {
    throw new Error("--to, --subject, and --body are all required");
  }
  const from = await getMyEmail(token);
  const raw = buildRawEmail({ to, from, subject, body, isHtml });
  const result = await gmailRequest("POST", `${BASE}/messages/send`, { raw }, token);
  console.log(`\n✅ Email sent to ${to}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Message ID: ${result.id}`);
}

async function sendReport(token, filepath, to) {
  const recipient = to || DEFAULT_TO;
  if (!recipient) {
    throw new Error("Provide --to <email> or set GOOGLE_MAIL_DEFAULT_TO in .env");
  }
  if (!fs.existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}`);
  }

  const content = fs.readFileSync(filepath, "utf8");
  const filename = path.basename(filepath);
  const subject = `Report: ${filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ")} — ${new Date().toISOString().slice(0, 10)}`;

  // Convert markdown to simple HTML
  const html = `<html><body><pre style="font-family:monospace;white-space:pre-wrap;max-width:800px">${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre></body></html>`;

  const from = await getMyEmail(token);
  const raw = buildRawEmail({ to: recipient, from, subject, body: html, isHtml: true });
  const result = await gmailRequest("POST", `${BASE}/messages/send`, { raw }, token);
  console.log(`\n✅ Report sent to ${recipient}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Message ID: ${result.id}`);
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const flag = (f) => args.includes(f);
  const arg = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
  const count = parseInt(arg("--count") || "10", 10);

  const token = await getAccessToken();

  if (flag("--list")) {
    await listMessages(token, count);
  } else if (flag("--read")) {
    await readMessage(token, arg("--read"));
  } else if (flag("--search")) {
    await searchMessages(token, arg("--search"), count);
  } else if (flag("--send")) {
    await sendMessage(token, {
      to: arg("--to"),
      subject: arg("--subject"),
      body: arg("--body"),
    });
  } else if (flag("--send-report")) {
    await sendReport(token, arg("--send-report"), arg("--to"));
  } else {
    console.log(`
Gmail CLI

Usage:
  node scripts/google-mail.js --list [--count 10]
  node scripts/google-mail.js --read <messageId>
  node scripts/google-mail.js --search <query> [--count 10]
  node scripts/google-mail.js --send --to "email" --subject "..." --body "..."
  node scripts/google-mail.js --send-report <filepath> [--to "email"]

Env: GOOGLE_MAIL_DEFAULT_TO (optional default recipient)
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
