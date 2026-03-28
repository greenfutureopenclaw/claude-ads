#!/usr/bin/env node
/**
 * google-calendar.js — Google Calendar integration for content planning.
 *
 * Usage:
 *   node scripts/google-calendar.js --list [--days 30]
 *   node scripts/google-calendar.js --create --title "..." --date "2026-03-25" [--time "14:00"] [--desc "..."] [--duration 60]
 *   node scripts/google-calendar.js --sync-to-context    # writes upcoming events to context/google/calendar.md
 *   node scripts/google-calendar.js --content-calendar   # show content calendar events only
 *   node scripts/google-calendar.js --delete <eventId>
 *
 * Requires .env:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *   GOOGLE_CALENDAR_ID  (optional: defaults to "primary")
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { getAccessToken } = require("./google-auth");

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";
const CONTEXT_DIR = path.resolve(__dirname, "..", "context", "google");
const BASE = "https://www.googleapis.com/calendar/v3";

// ── Helpers ──────────────────────────────────────────────────────────────────

function calRequest(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const urlObj = new URL(url);
    const req = https.request(
      { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(bodyStr ? { "Content-Length": Buffer.byteLength(bodyStr) } : {}),
        }
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`Calendar API ${res.statusCode}: ${data.slice(0, 300)}`));
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

function formatEvent(e) {
  const start = e.start?.dateTime || e.start?.date || "";
  const end = e.end?.dateTime || e.end?.date || "";
  const dateStr = start.includes("T")
    ? new Date(start).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" })
    : start;
  return { title: e.summary || "(no title)", date: dateStr, desc: e.description || "", id: e.id, start, end, location: e.location || "" };
}

// ── Operations ────────────────────────────────────────────────────────────────

async function listEvents(token, days = 30, filterContent = false) {
  const now = new Date().toISOString();
  const future = new Date(Date.now() + days * 86400000).toISOString();
  const calId = encodeURIComponent(CALENDAR_ID);

  const url = `${BASE}/calendars/${calId}/events?` + new URLSearchParams({
    timeMin: now,
    timeMax: future,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });

  const result = await calRequest("GET", url, null, token);
  let events = (result.items || []).map(formatEvent);

  if (filterContent) {
    events = events.filter(e =>
      e.title.toLowerCase().includes("post") ||
      e.title.toLowerCase().includes("ad") ||
      e.title.toLowerCase().includes("content") ||
      e.title.toLowerCase().includes("publish") ||
      e.title.toLowerCase().includes("launch") ||
      e.title.toLowerCase().includes("campaign")
    );
  }

  return events;
}

async function printEvents(token, days, filterContent = false) {
  const events = await listEvents(token, days, filterContent);
  if (events.length === 0) {
    console.log(`\n(no ${filterContent ? "content " : ""}events in the next ${days} days)`);
    return;
  }

  const label = filterContent ? "Content Calendar" : "Upcoming Events";
  console.log(`\n📅 ${label} — next ${days} days:\n`);
  for (const e of events) {
    console.log(`  📌 ${e.title}`);
    console.log(`     ${e.date}${e.location ? " · " + e.location : ""}`);
    if (e.desc) console.log(`     ${e.desc.slice(0, 100)}${e.desc.length > 100 ? "..." : ""}`);
    console.log(`     ID: ${e.id}`);
    console.log();
  }
  console.log(`${events.length} event(s)`);
}

async function createEvent(token, { title, date, time, description, duration = 60, location = "" }) {
  if (!title || !date) {
    throw new Error("--title and --date are required");
  }

  let start, end;
  if (time) {
    const startDt = new Date(`${date}T${time}:00+08:00`); // Philippines timezone
    const endDt = new Date(startDt.getTime() + duration * 60000);
    start = { dateTime: startDt.toISOString(), timeZone: "Asia/Manila" };
    end = { dateTime: endDt.toISOString(), timeZone: "Asia/Manila" };
  } else {
    start = { date };
    end = { date: new Date(new Date(date).getTime() + 86400000).toISOString().slice(0, 10) };
  }

  const calId = encodeURIComponent(CALENDAR_ID);
  const event = await calRequest("POST", `${BASE}/calendars/${calId}/events`, {
    summary: title,
    description: description || "",
    location,
    start,
    end,
  }, token);

  console.log(`\n✅ Event created: "${event.summary}"`);
  console.log(`   Date: ${event.start?.dateTime || event.start?.date}`);
  console.log(`   ID: ${event.id}`);
  console.log(`   Link: ${event.htmlLink}`);
}

async function deleteEvent(token, eventId) {
  const calId = encodeURIComponent(CALENDAR_ID);
  await calRequest("DELETE", `${BASE}/calendars/${calId}/events/${eventId}`, null, token);
  console.log(`✅ Event ${eventId} deleted.`);
}

async function syncToContext(token) {
  const events = await listEvents(token, 60);
  if (!fs.existsSync(CONTEXT_DIR)) fs.mkdirSync(CONTEXT_DIR, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    `# Content Calendar`,
    `*Synced from Google Calendar — ${today}*`,
    "",
    `## Upcoming Events (next 60 days)`,
    "",
  ];

  if (events.length === 0) {
    lines.push("*(no upcoming events)*");
  } else {
    for (const e of events) {
      lines.push(`### ${e.title}`);
      lines.push(`**Date:** ${e.date}`);
      if (e.location) lines.push(`**Location:** ${e.location}`);
      if (e.desc) lines.push(`**Notes:** ${e.desc}`);
      lines.push(`**ID:** \`${e.id}\``);
      lines.push("");
    }
  }

  const outPath = path.join(CONTEXT_DIR, "calendar.md");
  fs.writeFileSync(outPath, lines.join("\n"));
  console.log(`✅ ${events.length} events synced to context/google/calendar.md`);
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const flag = (f) => args.includes(f);
  const arg = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
  const days = parseInt(arg("--days") || "30", 10);

  const token = await getAccessToken();

  if (flag("--list")) {
    await printEvents(token, days);
  } else if (flag("--content-calendar")) {
    await printEvents(token, days, true);
  } else if (flag("--create")) {
    await createEvent(token, {
      title: arg("--title"),
      date: arg("--date"),
      time: arg("--time"),
      description: arg("--desc"),
      duration: parseInt(arg("--duration") || "60", 10),
      location: arg("--location") || "",
    });
  } else if (flag("--delete")) {
    await deleteEvent(token, arg("--delete"));
  } else if (flag("--sync-to-context") || flag("--sync")) {
    await syncToContext(token);
  } else {
    console.log(`
Google Calendar CLI

Usage:
  node scripts/google-calendar.js --list [--days 30]
  node scripts/google-calendar.js --content-calendar [--days 30]
  node scripts/google-calendar.js --create --title "..." --date "2026-03-25" [--time "14:00"] [--desc "..."] [--duration 60] [--location "..."]
  node scripts/google-calendar.js --delete <eventId>
  node scripts/google-calendar.js --sync-to-context

Env: GOOGLE_CALENDAR_ID (optional, defaults to "primary")
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
