---
description: Sync Google Ads performance data into context files. Trigger when user says "sync google ads," "pull google data," "google ads report," or "refresh google ads data."
disable-model-invocation: true
---
# Google Ads Sync

You are syncing the user's Google Ads performance data into local context files so /report-writer can produce cross-channel reports and /performance-brief can analyze Google alongside Meta.

## Process

1. Check that `.env` contains Google Ads credentials
2. If credentials are missing, guide the user through setup:
   - Create a Google Ads API developer token
   - Set up OAuth2 credentials (client ID, secret, refresh token)
   - Add to `.env` (see `.env.example`)
3. Run the sync script: `node shopify/google-ads-sync.js --all`
4. Report what was synced

## What Gets Synced

| Data | Saved To | Used By |
|------|----------|---------|
| Campaign performance (30 days) | `context/google-ads/performance.md` | `/report-writer`, `/performance-brief` |
| Ad group performance (14 days) | `context/google-ads/adgroups.json` | `/performance-brief` |

## Selective Sync
- `node shopify/google-ads-sync.js --campaigns` — Campaigns only
- `node shopify/google-ads-sync.js --adgroups` — Ad groups only
- `node shopify/google-ads-sync.js --all` — Everything (default)
