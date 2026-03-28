---
description: Sync Shopify data (products, reviews, orders) into context files. Trigger when user says "sync shopify," "pull shopify data," "update product catalog," "get shopify reviews," or "refresh store data."
disable-model-invocation: true
---
# Shopify Sync

You are syncing the user's Shopify store data into local context files so all creative skills have access to real product data, customer reviews, and sales metrics.

## Process

1. Check that `.env` contains `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_ACCESS_TOKEN`
2. If credentials are missing, guide the user through setup:
   - Go to Shopify Admin > Settings > Apps and sales channels > Develop apps
   - Create a custom app with scopes: `read_products`, `read_orders`, `read_content`
   - Copy the Admin API access token
   - Add to `.env` (see `.env.example`)
3. Run the sync script: `node shopify/sync.js --all`
4. Report what was synced

## What Gets Synced

| Data | Saved To | Used By |
|------|----------|---------|
| Product catalog | `context/shopify/products.md` | `/brief-generator`, `/hook-writer`, `/ad-variations`, `/static-ads` |
| Customer reviews | `context/shopify/reviews.md` | `/review-miner` |
| Sales & orders | `context/shopify/orders.md` | `/report-writer`, `/fatigue-detector` |

## Selective Sync

The user can sync specific data types:
- `node shopify/sync.js --products` — Products only
- `node shopify/sync.js --orders` — Orders only
- `node shopify/sync.js --reviews` — Reviews only
- `node shopify/sync.js --all` — Everything (default)

## After Sync

Once data is synced, remind the user that all creative skills now have access to their Shopify data automatically. For example:
- `/brief-generator` will use real product descriptions and pricing
- `/review-miner` can analyze synced reviews (or the user can still provide additional review sources)
- `/report-writer` can incorporate Shopify revenue data alongside ad metrics

## Reviews Note

If no reviews are found via the Shopify API, suggest:
1. Adding `JUDGEME_API_TOKEN` to `.env` if they use Judge.me
2. Exporting reviews as CSV from their reviews app (Stamped, Loox, Yotpo)
3. Running `/review-miner` directly with the CSV
