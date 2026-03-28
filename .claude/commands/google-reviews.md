---
description: Sync Google Business Profile reviews into context for voice-of-customer research. Trigger when user says "sync google reviews," "pull google reviews," "google my business reviews," or "get customer reviews from google." Also trigger on /google-reviews.
disable-model-invocation: true
argument-hint: "[--sync | --list | --setup-info]"
---
# Google Business Profile Reviews

Fetch customer reviews from Google Business Profile (formerly Google My Business) and sync to `context/google/reviews.md`. Reviews feed directly into `/review-miner` and `/audience-segments` alongside Shopify reviews.

## Setup Check
Verify `.env` has `GOOGLE_REFRESH_TOKEN`. If missing: `node scripts/google-setup.js`

Also requires `GOOGLE_BUSINESS_ACCOUNT_ID` and `GOOGLE_BUSINESS_LOCATION_ID`. To find them:
```bash
node scripts/google-reviews.js --setup-info
```

## Operations

### First-time setup — find your IDs
```bash
node scripts/google-reviews.js --setup-info
```
Copy the account ID and location ID into `.env`.

### Sync reviews to context
```bash
node scripts/google-reviews.js --sync
```
Writes to `context/google/reviews.md`. Run this alongside `/shopify-sync` for a complete VOC picture.

### List reviews in terminal
```bash
node scripts/google-reviews.js --list
```

## Note on API Access
The Google Business Profile API requires app verification from Google for production use. If the API is unavailable:
- The `--sync` command writes a placeholder file with a manual entry section
- Use the Telegram bot `/save_review` command to add reviews manually
- Reviews added manually are preserved across subsequent syncs

## Integration with Creative Skills
After syncing, Google reviews are automatically available to:
- `/review-miner` — extracts patterns, pain points, emotional language
- `/audience-segments` — adds Google reviewers as a data signal
- `/hook-writer` — can reference Google review quotes as social proof
