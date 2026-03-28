# Potico.ph — Social Media AI System

An AI-powered social media operations system built on Claude (Anthropic) and operated entirely through a Telegram bot. The team creates content, syncs performance data, generates images, and manages campaigns — all from Telegram, without needing access to any CLI or code.

---

## How It Works

The system has three layers:

1. **Data layer** — Sync scripts pull live data from Shopify, Meta, Google Ads, TikTok, and Google Workspace into `context/` markdown files
2. **Brain layer** — Claude (claude-opus-4-6) reads all context files and brand assets every time it responds, so it always knows the products, performance numbers, and brand voice
3. **Interface layer** — A Telegram bot is the team's single interface for everything: content generation, data syncs, image generation, and reporting

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure credentials

```bash
cp .env.example .env
# Fill in your credentials (see .env.example for all variables)
```

### 3. Connect Google Workspace (one-time OAuth setup)

```bash
npm run google:setup
# Opens a browser → approve → refresh token is saved to .env automatically
```

### 4. Start the bot

```bash
npm run bot
```

The bot runs as a persistent process. Restart it after any `.env` changes.

---

## Telegram Bot Commands

The bot is the primary interface for the whole team. All commands appear in Telegram's `/` autocomplete menu.

### Sync & Data

| Command | What it does |
|---------|-------------|
| `/sync_all` | Sync all platforms at once (Shopify + Google Ads + TikTok + Meta) |
| `/sync_meta` | Sync Facebook Page & Instagram performance data |
| `/sync_shopify` | Sync Shopify products, reviews, and orders |
| `/sync_google` | Sync Google Ads campaign performance |
| `/sync_tiktok` | Sync TikTok Ads performance data |
| `/sync_ads` | Sync competitor & inspiration ads from Meta Ads Library |
| `/save_ad [text]` | Manually save a competitor ad to the inspiration library |

### Google Workspace

| Command | What it does |
|---------|-------------|
| `/gdrive_sync` | Pull product images from Google Drive → `context/assets/` |
| `/gcal` | Show upcoming Google Calendar events (next 30 days) |
| `/gcal_sync` | Sync Google Calendar to context (for content planning) |
| `/greviews` | Sync Google Business Profile reviews to context |
| `/gmail` | List recent Gmail inbox messages |
| `/gmail_report [filepath]` | Email a report file to the team |

### Image Generation

| Command | What it does |
|---------|-------------|
| `/gen_image [ratio] [description]` | Generate an on-brand image. Ratios: `1:1`, `4:3`, `3:4`, `9:16`, `16:9` |

Images are generated via Gemini Flash with an on-brand prompt built by Claude — brand colors, visual style, and logos are applied automatically.

### Research & Strategy (Claude Code skills)

| Command | What it does |
|---------|-------------|
| `/competitor_audit` | Run a competitive creative audit on a DTC brand |
| `/review_miner` | Extract voice-of-customer insights from reviews |
| `/audience_segments` | Build micro-segments from Shopify purchase data (RFM) |

### Analytics & Optimization

| Command | What it does |
|---------|-------------|
| `/report_writer` | Write a weekly cross-channel performance report |
| `/fatigue_detector` | Flag fatiguing creatives with replacement suggestions |
| `/performance_brief` | Generate a data-driven creative brief from ad data |
| `/creative_score` | Score creative concepts against historical winners |
| `/ab_test_plan` | Design structured A/B test plans |

### Creative Development

| Command | What it does |
|---------|-------------|
| `/brief_generator` | Generate a creative brief (Meta, TikTok, Email, Pinterest) |
| `/hook_writer` | Write 15+ ad hooks and short-form video scripts |
| `/ad_variations` | Generate 10-20 copy variations from a winning ad |
| `/tiktok_script` | Write TikTok-native short-form video scripts |
| `/email_writer` | Write email campaigns and automation flows |
| `/prompt_composer` | Compose optimized AI image generation prompts |
| `/concept_planner` | Plan a multi-concept campaign across formats and personas |

### Production

| Command | What it does |
|---------|-------------|
| `/static_ads` | Create production-ready static ad layouts as HTML |
| `/advertorial_builder` | Build a DR advertorial framework for the brand |
| `/repurpose` | Repurpose content into multi-platform assets |
| `/weekly_creative_sprint` | Run a full weekly creative cycle: analyze → plan → produce |

### Utility

| Command | What it does |
|---------|-------------|
| `/clear` | Reset conversation history for the current chat |
| `/help` | Show all available commands |

---

## Natural Language Content Creation

Beyond slash commands, just type naturally in the bot. Claude reads all context (brand, products, performance data) automatically.

**Examples:**
- `"Write 10 hooks for our bestselling hamper"` → 10 on-brand ad hooks
- `"Create a post for ig stories"` → Copy + auto-generated 9:16 image (no extra command needed)
- `"What's our best performing ad format this month?"` → Data-driven answer from synced performance files
- `"Generate this week's performance report"` → Structured cross-channel report
- `"Write a TikTok script for our Mother's Day hamper"` → Full script with hooks and CTA

**Auto-image generation:** When your message asks to create a post, story, or ad for a specific platform, the bot automatically generates the matching image after delivering the copy — correct aspect ratio, on-brand colors, no extra command required.

**Product image reference:** When you mention "product" or "reference" in your message, the bot sends the actual product photos from `context/assets/` to Claude as vision input, so Claude can see the products when writing copy or directing the image generation.

---

## Platform Integrations

### Shopify

- **Script:** `scripts/sync.js`
- **npm:** `npm run shopify:sync`
- **Required env:** `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ACCESS_TOKEN`
- **Output:** `context/shopify/products.md`, `context/shopify/reviews.md`, `context/shopify/orders.md`
- **Setup:** Create a custom app in Shopify Admin → Settings → Apps → Develop apps. Grant scopes: `read_products`, `read_orders`, `read_content`

### Meta (Facebook + Instagram)

- **Script:** `scripts/meta-sync.js`
- **npm:** `npm run meta:sync`
- **Required env:** `META_ACCESS_TOKEN`, `META_PAGE_ID`, `META_INSTAGRAM_ID`
- **Output:** `context/meta/performance.md`
- **Test connection:** `npm run meta:test`
- **Setup:** Get a Page Access Token from Meta Business Suite or Graph API Explorer. Required permissions: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_manage_insights`, `instagram_content_publish`

### Meta Ads Library (Competitor Research)

- **Script:** `scripts/meta-ads-library.js`
- **npm:** `npm run ads:inspiration`
- **Required env:** `META_USER_ACCESS_TOKEN`, `META_AD_SEARCH_TERMS`, `META_COMPETITOR_PAGE_IDS`
- **Output:** `context/meta/ads-library.md`
- **Note:** Requires the Meta app to be in Live mode with Business Tools Terms accepted. If blocked, use `/save_ad` in the bot to manually add competitor ads.

### Google Ads

- **Script:** `scripts/google-ads-sync.js`
- **npm:** `npm run google:sync`
- **Required env:** `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`
- **Output:** `context/google-ads/performance.md`

### TikTok Ads

- **Script:** `scripts/tiktok-sync.js`
- **npm:** `npm run tiktok:sync`
- **Required env:** `TIKTOK_ACCESS_TOKEN`, `TIKTOK_ADVERTISER_ID`
- **Output:** `context/tiktok-ads/performance.md`

### Google Workspace (Drive, Calendar, Gmail, Business Profile)

All Google Workspace integrations share a single OAuth2 refresh token.

**One-time setup:**
```bash
npm run google:setup
```
This opens a browser OAuth consent screen. Approve it, and the refresh token is saved to `.env` automatically.

**Required env:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`

**Setup steps in Google Cloud Console:**
1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Enable: Drive API, Calendar API, Gmail API, My Business Account Management API
3. Create OAuth 2.0 credentials (Desktop app type)
4. Add redirect URI: `http://localhost:3999/oauth2callback`
5. Add your Google account as a test user under OAuth consent screen

| Feature | npm script | Required env | Output |
|---------|-----------|-------------|--------|
| Google Drive sync | `npm run google:sync-assets` | `GOOGLE_DRIVE_FOLDER_ID` | `context/assets/` |
| Calendar sync | `npm run google:sync-context` | `GOOGLE_CALENDAR_ID` (optional) | `context/google/calendar.md` |
| Business Reviews | `npm run google:reviews -- --sync` | `GOOGLE_BUSINESS_ACCOUNT_ID`, `GOOGLE_BUSINESS_LOCATION_ID` | `context/google/reviews.md` |
| Gmail | `npm run google:mail` | `GOOGLE_MAIL_DEFAULT_TO` (optional) | — |

**Google Drive product image pipeline:**
Drop product images into the configured Drive folder → tap `/gdrive_sync` in Telegram → images land in `context/assets/` → Claude sees them as vision input on the next content request.

---

## Context Files

Claude reads these files automatically on every request. Sync them regularly to keep the AI up to date.

```
context/
├── brand-voice.md          # Brand kit: colors, fonts, tone, copy rules, visual identity
├── brief-template.md       # Default creative brief template
├── personas.md             # Target audience personas with pain points and triggers
├── ad-formats.json         # Library of 20 ad formats with visual and copy rules
├── assets/                 # Logos, product photos, lifestyle images (JPG, PNG, WebP, SVG)
├── reference-ads/          # Best-performing ads used as on-brand style references
├── shopify/
│   ├── products.md         # Full product catalog
│   ├── reviews.md          # Customer reviews
│   ├── orders.md           # Sales metrics (last 60 days)
│   └── segments.md         # Audience micro-segments from RFM analysis
├── google-ads/
│   └── performance.md      # Campaign and ad group performance
├── tiktok-ads/
│   └── performance.md      # Campaign and ad-level performance
├── meta/
│   ├── performance.md      # Facebook Page + Instagram performance
│   └── ads-library.md      # Competitor and inspiration ads
└── google/
    ├── calendar.md         # Content calendar events
    └── reviews.md          # Google Business Profile reviews
```

---

## Brand Assets

Store brand assets in `context/assets/`. They are version-controlled and automatically passed to Claude as vision input during content and image generation.

- **Logos:** PNG and JPG formats (SVG is stored but not sent to AI vision APIs)
- **Product photos:** Drop via `/gdrive_sync` or add directly
- **Reference ads:** Put in `context/reference-ads/` — auto-injected as style references for all creative work

---

## Image Generation

Images are generated by Gemini Flash (`gemini-2.5-flash-image`) via the Google AI Studio API.

**How it works:**
1. Claude receives the user's request + brand-voice.md + logos + product photos (as base64 vision input)
2. Claude writes an optimized Gemini prompt with brand colors, mood, lighting, and style rules
3. Gemini generates the image
4. The bot sends the image with the prompt in the caption

**Brand rules enforced in every image:**
- Primary teal `#00C2CB`, accent coral `#FF6F61`, clean `#F4F4F4` background
- Soft, warm, natural lighting
- Warm, approachable, lifestyle photography style
- Logo placement: bottom-right corner

**Required env:** `GEMINI_API_KEY` — get one free at [aistudio.google.com](https://aistudio.google.com/app/apikey)

---

## Environment Variables

See `.env.example` for the full list with comments. Never commit `.env` — it is gitignored.

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | From @BotFather |
| `ANTHROPIC_API_KEY` | Yes | From console.anthropic.com |
| `GEMINI_API_KEY` | Yes | For image generation — aistudio.google.com |
| `SHOPIFY_STORE_DOMAIN` | For Shopify | e.g. `your-store.myshopify.com` |
| `SHOPIFY_ACCESS_TOKEN` | For Shopify | Custom app access token |
| `META_ACCESS_TOKEN` | For Meta | Page Access Token |
| `META_PAGE_ID` | For Meta | Facebook Page ID |
| `META_INSTAGRAM_ID` | For Meta | Instagram Business Account ID |
| `GOOGLE_ADS_*` | For Google Ads | See Google Ads API docs |
| `TIKTOK_ACCESS_TOKEN` | For TikTok | From TikTok Business Center |
| `TIKTOK_ADVERTISER_ID` | For TikTok | Advertiser account ID |
| `GOOGLE_CLIENT_ID` | For Google Workspace | OAuth2 client ID |
| `GOOGLE_CLIENT_SECRET` | For Google Workspace | OAuth2 client secret |
| `GOOGLE_REFRESH_TOKEN` | For Google Workspace | Auto-set by `npm run google:setup` |
| `GOOGLE_DRIVE_FOLDER_ID` | For Drive sync | Folder ID from Drive URL |
| `GOOGLE_MAIL_DEFAULT_TO` | Optional | Default recipient for email reports |

---

## npm Scripts

```bash
npm run bot                 # Start the Telegram bot

# Shopify
npm run shopify:sync        # Sync all Shopify data
npm run shopify:products    # Sync products only
npm run shopify:orders      # Sync orders only
npm run shopify:reviews     # Sync reviews only

# Meta
npm run meta:sync           # Sync Facebook + Instagram performance
npm run meta:test           # Test Meta API connection
npm run ads:inspiration     # Sync Meta Ads Library (competitor research)

# Google Ads
npm run google:sync         # Sync Google Ads performance

# TikTok
npm run tiktok:sync         # Sync TikTok Ads performance

# Google Workspace
npm run google:setup        # One-time OAuth2 setup (opens browser)
npm run google:drive        # Google Drive operations
npm run google:calendar     # Google Calendar operations
npm run google:mail         # Gmail operations
npm run google:reviews      # Google Business Profile reviews
npm run google:sync-context # Sync Calendar + Reviews to context files
npm run google:sync-assets  # Pull product images from Drive → context/assets/

# Sync everything at once
npm run sync:all            # Shopify + Google Ads + TikTok + Meta
```

---

## Project Structure

```
social_media/
├── scripts/
│   ├── telegram-bot.js       # Main bot — all Telegram commands and message handling
│   ├── sync.js               # Shopify sync
│   ├── meta-sync.js          # Meta (Facebook + Instagram) sync
│   ├── meta-ads-library.js   # Meta Ads Library competitor research
│   ├── meta-test.js          # Meta API connection test
│   ├── google-ads-sync.js    # Google Ads sync
│   ├── tiktok-sync.js        # TikTok Ads sync
│   ├── google-setup.js       # Google OAuth2 setup wizard
│   ├── google-auth.js        # Shared Google OAuth2 token refresh
│   ├── google-drive.js       # Drive upload/download/sync
│   ├── google-calendar.js    # Calendar read/create/sync
│   ├── google-mail.js        # Gmail read/send
│   └── google-reviews.js     # Google Business Profile reviews
├── context/                  # All AI context files (auto-loaded by Claude)
├── .claude/commands/         # Claude Code slash command definitions (skills)
├── .env                      # Credentials (gitignored)
├── .env.example              # Credential template
├── CLAUDE.md                 # Claude Code instructions and skill definitions
└── package.json
```

---

## Claude Code Skills

This repo also works as a Claude Code project. The `.claude/commands/` folder contains skill definitions for every creative operation. When working in Claude Code (not the Telegram bot), use slash commands like `/hook-writer`, `/brief-generator`, `/report-writer`, etc.

These skills automatically load all context files, brand assets, and reference ads before executing — the same brand intelligence the Telegram bot uses.
