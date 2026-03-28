---
description: Sync Meta (Facebook Page + Instagram) performance data into context files. Trigger when user says "sync meta," "sync facebook," "pull meta data," "instagram performance," "facebook insights," or "refresh meta data."
disable-model-invocation: true
---
# Meta Sync

You are syncing Meta (Facebook Page + Instagram) performance data into local context files so `/report-writer` can produce cross-channel reports, `/performance-brief` can analyze Meta alongside Google and TikTok, and `/fatigue-detector` can track creative health.

## Process

1. Check that `.env` contains Meta credentials (`META_ACCESS_TOKEN`, `META_PAGE_ID`, `META_INSTAGRAM_ID`)
2. If credentials are missing, guide the user:
   - Go to [Meta for Developers](https://developers.facebook.com/) → your app → Tools → Graph API Explorer
   - Generate a long-lived Page access token with permissions: `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_manage_insights`, `ads_read`
   - Add token to `.env` as `META_ACCESS_TOKEN`
   - Add your Facebook Page ID as `META_PAGE_ID`
   - Add your Instagram Business Account ID as `META_INSTAGRAM_ID`
3. Run: `node scripts/meta-sync.js --all`
4. Report what was synced

## What Gets Synced

- **Facebook Page**: Post performance (reach, impressions, engagement, reactions) for last 30 days
- **Instagram**: Post and reel performance (reach, impressions, likes, comments, saves, shares)
- **Ads**: Campaign-level and ad-set-level performance if `META_AD_ACCOUNT_ID` is set

## Output

Data lands in `context/meta/`:
- `performance.md` — Cross-platform performance summary
- `ads-library.md` — Competitor and inspiration ads (manual + API entries)

## Troubleshooting

- **Token expired**: Meta Page tokens expire after 60 days. Regenerate at Meta for Developers → Graph API Explorer
- **Permission error**: Ensure the token has `instagram_manage_insights` scope
- **Missing Instagram data**: Confirm the Instagram account is a Business account linked to your Facebook Page
- **Test connection**: Run `npm run meta:test`
