---
description: Sync TikTok Ads performance data into context files. Trigger when user says "sync tiktok ads," "pull tiktok data," "tiktok performance," or "refresh tiktok data."
disable-model-invocation: true
---
# TikTok Ads Sync

You are syncing the user's TikTok Ads performance data into local context files so /report-writer can produce cross-channel reports and /fatigue-detector can track TikTok creative health.

## Process

1. Check that `.env` contains TikTok Ads credentials
2. If credentials are missing, guide the user through setup:
   - Go to TikTok Business Center > Assets > Developer Portal
   - Create an app and get access token + advertiser ID
   - Add to `.env` (see `.env.example`)
3. Run the sync script: `node shopify/tiktok-sync.js --all`
4. Report what was synced

## What Gets Synced

| Data | Saved To | Used By |
|------|----------|---------|
| Campaign performance (30 days) | `context/tiktok-ads/performance.md` | `/report-writer`, `/performance-brief` |
| Ad-level performance (14 days) | `context/tiktok-ads/ads.json` | `/fatigue-detector`, `/performance-brief` |

## TikTok-Specific Metrics
- Video play actions, 2s view rate, 6s view rate
- Frequency per ad (important for fatigue detection)
- Conversion rate and ROAS

## Selective Sync
- `node shopify/tiktok-sync.js --campaigns` — Campaigns only
- `node shopify/tiktok-sync.js --ads` — Ads only
- `node shopify/tiktok-sync.js --all` — Everything (default)
