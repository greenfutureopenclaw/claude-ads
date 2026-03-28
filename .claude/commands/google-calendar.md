---
description: Read and manage Google Calendar for content planning and campaign scheduling. Trigger when user asks about upcoming posts, content calendar, campaign dates, scheduling a launch, "what's on the calendar," "add a content event," or "sync calendar." Also trigger on /google-calendar.
disable-model-invocation: true
argument-hint: "[--list | --content-calendar | --create | --sync-to-context]"
---
# Google Calendar

Read and manage your content calendar in Google Calendar. Syncs upcoming events to `context/google/calendar.md` so creative skills can reference campaign timelines.

## Setup Check
Verify `.env` has `GOOGLE_REFRESH_TOKEN`. If missing: `node scripts/google-setup.js`

## Operations

### Show upcoming events
```bash
node scripts/google-calendar.js --list
node scripts/google-calendar.js --list --days 60
```

### Show content calendar only (filters for ad/campaign/publish events)
```bash
node scripts/google-calendar.js --content-calendar
node scripts/google-calendar.js --content-calendar --days 30
```

### Create a content event
```bash
node scripts/google-calendar.js --create \
  --title "Mother's Day Campaign Launch" \
  --date "2026-05-10" \
  --time "09:00" \
  --desc "Meta + TikTok creatives go live" \
  --duration 60
```
For all-day events, omit `--time`.

### Sync to context (writes context/google/calendar.md)
```bash
node scripts/google-calendar.js --sync-to-context
```
Run this to make calendar data available to `/performance-brief` and `/weekly-creative-sprint`.

### Delete an event
```bash
node scripts/google-calendar.js --delete <eventId>
```

## Env Variables
- `GOOGLE_CALENDAR_ID` — Calendar to use (optional, defaults to `primary`). Set to a specific calendar ID for a dedicated content calendar.

## Tips
- Run `--sync-to-context` weekly so `/weekly-creative-sprint` can reference upcoming campaign dates
- Name content events clearly: include "Campaign," "Launch," "Post," "Ad" so the content calendar filter picks them up
- Use Philippines timezone (Asia/Manila) — events are created with `+08:00` offset automatically
