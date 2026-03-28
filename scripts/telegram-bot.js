#!/usr/bin/env node

/**
 * Social Media AI Assistant — Telegram Bot
 *
 * A full Claude-powered assistant for social media managers.
 * Supports content generation, performance analysis, data syncs, and more.
 *
 * Usage: node scripts/telegram-bot.js
 *
 * Required in .env:
 *   TELEGRAM_BOT_TOKEN   — from @BotFather on Telegram
 *   ANTHROPIC_API_KEY    — from console.anthropic.com
 */

const { Telegraf } = require("telegraf");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

// ── Load .env ────────────────────────────────────────────────────────────────

const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

const _sdk = require("@anthropic-ai/sdk");
const Anthropic = _sdk.default ?? _sdk;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CONTEXT_DIR = path.resolve(__dirname, "..", "context");

if (!BOT_TOKEN) {
  console.error("❌ Missing TELEGRAM_BOT_TOKEN in .env");
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error("❌ Missing ANTHROPIC_API_KEY in .env");
  process.exit(1);
}

const https = require("https");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const bot = new Telegraf(BOT_TOKEN);
const claude = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Per-chat conversation history
const conversations = new Map();
const MAX_HISTORY = 20;

// ── Context Loading ───────────────────────────────────────────────────────────

function readCtxFile(rel) {
  const p = path.join(CONTEXT_DIR, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
}

function loadContext() {
  const files = [
    ["Brand Voice & Identity", "brand-voice.md"],
    ["Creative Brief Template", "brief-template.md"],
    ["Target Audience Personas", "personas.md"],
    ["Ad Formats Library", "ad-formats.json"],
    ["Shopify Products", "shopify/products.md"],
    ["Customer Reviews", "shopify/reviews.md"],
    ["Sales & Order Data", "shopify/orders.md"],
    ["Audience Segments", "shopify/segments.md"],
    ["Google Ads Performance", "google-ads/performance.md"],
    ["TikTok Ads Performance", "tiktok-ads/performance.md"],
    ["Meta (Facebook & Instagram) Performance", "meta/performance.md"],
    ["Competitor & Inspiration Ads (Meta Ads Library)", "meta/ads-library.md"],
    ["Google Business Reviews", "google/reviews.md"],
    ["Content Calendar", "google/calendar.md"],
  ];

  let ctx = "";
  for (const [label, file] of files) {
    const content = readCtxFile(file);
    if (content) ctx += `\n\n### ${label}\n${content}`;
  }

  // List available product images so Claude knows what assets exist
  const assetsDir = path.join(CONTEXT_DIR, "assets");
  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
    if (assetFiles.length > 0) {
      ctx += `\n\n### Available Product Images (context/assets/)\n${assetFiles.join(", ")}`;
    }
  }

  return ctx;
}

/**
 * Load up to `maxImages` product images from context/assets/ as base64 blocks
 * for inclusion in a Claude API message.
 */
function loadProductImageBlocks(maxImages = 2) {
  const assetsDir = path.join(CONTEXT_DIR, "assets");
  if (!fs.existsSync(assetsDir)) return [];
  try {
    const files = fs.readdirSync(assetsDir)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .slice(0, maxImages);
    return files.map(f => {
      const ext = path.extname(f).slice(1).toLowerCase().replace("jpg", "jpeg");
      const data = fs.readFileSync(path.join(assetsDir, f)).toString("base64");
      return { type: "image", source: { type: "base64", media_type: `image/${ext}`, data } };
    });
  } catch {
    return [];
  }
}

/**
 * Detect if the message is requesting visual social media content,
 * and return the appropriate aspect ratio (or null if not applicable).
 */
function detectPostPlatform(text) {
  const t = text.toLowerCase();
  if (/ig stor|instagram stor|\bstories\b/.test(t) || /\b9[:\s]16\b/.test(t)) return "9:16";
  if (/\btiktok\b|\breels?\b/.test(t)) return "9:16";
  if (/\b16[:\s]9\b|youtube|cover photo|\bbanner\b/.test(t)) return "16:9";
  if (/\b4[:\s]5\b|portrait post/.test(t)) return "4:5";
  if (/ig post|instagram post|facebook post|feed post|\b1[:\s]1\b/.test(t)) return "1:1";
  if (/\b(create|make|generate|design)\b.{0,40}\b(post|story|stories|creative|ad|visual)\b/i.test(text)) return "1:1";
  return null;
}

function buildSystemPrompt() {
  const context = loadContext();
  return `You are a senior social media marketing AI assistant embedded in a Telegram bot. You work directly with social media managers to help them create high-performing content, analyze data, and run campaigns.

You can help with:
- Writing ad hooks, captions, video scripts, and copy variations
- Generating performance reports and actionable insights from ad data
- Creating creative briefs and campaign concepts
- Suggesting content angles based on best-performing ads
- Building audience-specific messaging from persona data
- Reviewing and scoring creative ideas before launch

Guidelines:
- Be concise and actionable. Lead with the most important info.
- When writing copy, always give multiple options (5–10 minimum for hooks).
- When analyzing data, highlight the top 2–3 insights first.
- Stay on-brand at all times — use the brand voice and identity context.
- If asked for a report, structure it clearly with headers and bullet points.
- Format responses for Telegram (plain text, no markdown tables).
${context ? `\n---\n\n# Brand & Performance Context\n${context}` : ""}`;
}

// ── Sync Runner ───────────────────────────────────────────────────────────────

async function runSync(ctx, args, label) {
  const msg = await ctx.reply(`⏳ Syncing ${label}...`);

  return new Promise((resolve) => {
    const child = spawn("node", args, {
      cwd: path.resolve(__dirname, ".."),
    });

    let output = "";
    child.stdout.on("data", (d) => (output += d.toString()));
    child.stderr.on("data", (d) => (output += d.toString()));

    child.on("close", async (code) => {
      const icon = code === 0 ? "✅" : "❌";
      const lines = output
        .split("\n")
        .filter((l) => l.trim())
        .slice(-5)
        .join("\n");

      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          msg.message_id,
          undefined,
          `${icon} ${label}\n\n${lines || "Done."}`
        );
      } catch {
        await ctx.reply(`${icon} ${label} sync complete.`);
      }
      resolve(code);
    });
  });
}

// ── Claude Response with Streaming ───────────────────────────────────────────

function splitMessage(text, maxLen = 4000) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen * 0.6) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trim();
  }
  return chunks;
}

async function askClaude(ctx, messages) {
  const placeholder = await ctx.reply("✦ Thinking...");
  let fullText = "";
  let editTimer = null;

  const pushEdit = async (final) => {
    if (!fullText) return;
    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        placeholder.message_id,
        undefined,
        final ? fullText : fullText + " ▌"
      );
    } catch {
      // ignore rate-limit errors during live edits
    }
  };

  try {
    const stream = claude.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: buildSystemPrompt(),
      messages,
    });

    // Edit the placeholder every 2 seconds while Claude is streaming
    editTimer = setInterval(() => pushEdit(false), 2000);

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        fullText += event.delta.text;
      }
    }

    clearInterval(editTimer);

    // Send final response (split if over Telegram's 4096-char limit)
    const chunks = splitMessage(fullText);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      placeholder.message_id,
      undefined,
      chunks[0]
    );
    for (let i = 1; i < chunks.length; i++) {
      await ctx.reply(chunks[i]);
    }

    return fullText;
  } catch (err) {
    if (editTimer) clearInterval(editTimer);
    await ctx.telegram
      .editMessageText(
        ctx.chat.id,
        placeholder.message_id,
        undefined,
        `❌ Error: ${err.message}`
      )
      .catch(() => ctx.reply(`❌ Error: ${err.message}`));
    throw err;
  }
}

// ── Gemini Image Generation ───────────────────────────────────────────────────

// Supported aspect ratios
const ASPECT_RATIOS = ["1:1", "4:3", "3:4", "16:9", "9:16"];

/**
 * Generate an image via Gemini Flash image generation (AI Studio API key compatible).
 * Returns a Buffer of the generated PNG.
 */
async function generateImage(prompt, aspectRatio = "1:1") {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set in .env");

  // Embed aspect ratio as instruction in the prompt since generateContent
  // doesn't have a separate aspectRatio parameter like the Vertex AI predict endpoint
  const aspectInstruction =
    aspectRatio !== "1:1" ? ` Aspect ratio: ${aspectRatio}.` : "";
  const fullPrompt = prompt + aspectInstruction;

  const apiUrl = new URL(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"
  );
  apiUrl.searchParams.set("key", GEMINI_API_KEY);

  const body = JSON.stringify({
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: apiUrl.hostname,
        path: apiUrl.pathname + apiUrl.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`Gemini API ${res.statusCode}: ${data.slice(0, 400)}`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const parts = parsed.candidates?.[0]?.content?.parts || [];
            const imagePart = parts.find((p) => p.inlineData?.data);
            if (!imagePart) reject(new Error("No image returned from Gemini API"));
            else resolve(Buffer.from(imagePart.inlineData.data, "base64"));
          } catch {
            reject(new Error(`JSON parse error: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Auto-generate a social media image after Claude produces post copy.
 * Called automatically when the user's message is a visual content creation request.
 */
async function autoGeneratePostImage(ctx, userRequest, claudeResponse, ratio) {
  if (!GEMINI_API_KEY) return;
  const msg = await ctx.reply(`🎨 Generating ${ratio} visual...`);
  try {
    const imageContext = `Social media visual for: ${userRequest}\n\nContent brief:\n${claudeResponse.slice(0, 400)}`;
    const prompt = await buildImagePrompt(imageContext);
    const imageBuffer = await generateImage(prompt, ratio);
    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    await ctx.replyWithPhoto(
      { source: imageBuffer },
      { caption: `🎨 ${ratio} — auto-generated\n\nPrompt: ${prompt.slice(0, 200)}${prompt.length > 200 ? "…" : ""}` }
    );
  } catch (err) {
    await ctx.telegram
      .editMessageText(ctx.chat.id, msg.message_id, undefined,
        `⚠️ Auto-image failed: ${err.message}\n\nTry: /gen_image ${ratio} [description]`)
      .catch(() => {});
  }
}

/**
 * Ask Claude to turn a casual image request into an on-brand Gemini image prompt.
 * Passes brand colors, visual guidelines, and logo/product images as vision context.
 */
async function buildImagePrompt(userRequest) {
  // Load brand visual identity
  const brandVoice = readCtxFile("brand-voice.md") || "";

  // Extract key visual specs from brand-voice for the prompt instruction
  const brandVisualSpec = brandVoice
    ? `\n\nBrand Visual Spec (strictly follow):\n${brandVoice.slice(0, 800)}`
    : "";

  // Load all brand/product images (logos + product photos) as vision input for Claude
  const assetBlocks = loadProductImageBlocks(3);

  const userContent = [
    ...assetBlocks,
    {
      type: "text",
      text:
        `You are a creative director for Potico.ph. Convert this social media image request ` +
        `into a detailed Gemini image generation prompt that is STRICTLY on-brand.\n\n` +
        `Mandatory brand rules:\n` +
        `• Primary color: teal #00C2CB — use for accents, backgrounds, or highlights\n` +
        `• Accent color: coral #FF6F61 — use for CTAs or warm accents\n` +
        `• Background: clean white or light #F4F4F4 — never dark or busy\n` +
        `• Lighting: soft, warm, natural — studio-lifestyle feel\n` +
        `• Mood: warm, approachable, premium but accessible\n` +
        `• Style: clean flat-lay or lifestyle photography — not editorial or high-fashion\n` +
        `• The attached images are Potico.ph's logo and product photos — match this visual style\n` +
        `• End your prompt with: "Potico.ph logo placed bottom-right corner, small, tasteful"\n\n` +
        `Keep under 150 words. Return ONLY the image prompt, nothing else.\n\n` +
        `Request: ${userRequest}` +
        brandVisualSpec,
    },
  ];

  const res = await claude.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 400,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: userContent }],
  });
  return res.content.find((b) => b.type === "text")?.text?.trim() || userRequest;
}

// ── Commands ──────────────────────────────────────────────────────────────────

const WELCOME = `👋 Social Media AI Assistant

I help your team create content, analyze performance, and run campaigns — all from Telegram.

Sync your data first:
/sync_all — All platforms at once
/sync_meta — Facebook & Instagram
/sync_shopify — Products, reviews, orders
/sync_google — Google Ads
/sync_tiktok — TikTok Ads
/sync_ads — Competitor & inspiration ads (Meta Ads Library)
/save_ad [copy] — Save a competitor ad to the inspiration library
/gen_image [ratio] [description] — Generate an image (ratio: 1:1 4:3 9:16 16:9)

Google Workspace:
/gdrive_sync — Pull product images from Drive → context/assets
/gcal — Show upcoming calendar events (next 30 days)
/gcal_sync — Sync Google Calendar to context
/greviews — Sync Google Business Profile reviews to context
/gmail — List recent inbox messages
/gmail_report [filepath] — Email a report file to your team

Then ask me anything:
• "Write 10 hooks for our bestseller"
• "Generate this week's performance report"
• "Create a TikTok script for [product]"
• "What's our best performing ad format?"
• "Build a creative brief for a new campaign"
• "Write 5 email subject lines for our sale"

/clear — Reset conversation
/help — Show this message`;

bot.start((ctx) => ctx.reply(WELCOME));
bot.help((ctx) => ctx.reply(WELCOME));

bot.command("sync_all", async (ctx) => {
  await ctx.reply("🔄 Syncing all platforms...");
  await runSync(ctx, ["scripts/sync.js", "--all"], "Shopify");
  await runSync(
    ctx,
    ["scripts/google-ads-sync.js", "--all"],
    "Google Ads"
  );
  await runSync(
    ctx,
    ["scripts/tiktok-sync.js", "--all"],
    "TikTok Ads"
  );
  await runSync(ctx, ["scripts/meta-sync.js", "--all"], "Meta");
  await ctx.reply("✅ All platforms synced! Context is now up to date.");
});

bot.command("sync_meta", (ctx) =>
  runSync(ctx, ["scripts/meta-sync.js", "--all"], "Meta (Facebook & Instagram)")
);
bot.command("sync_shopify", (ctx) =>
  runSync(ctx, ["scripts/sync.js", "--all"], "Shopify")
);
bot.command("sync_google", (ctx) =>
  runSync(ctx, ["scripts/google-ads-sync.js", "--all"], "Google Ads")
);
bot.command("sync_tiktok", (ctx) =>
  runSync(ctx, ["scripts/tiktok-sync.js", "--all"], "TikTok Ads")
);
bot.command("sync_ads", (ctx) =>
  runSync(ctx, ["scripts/meta-ads-library.js"], "Competitor Ads Library")
);

// ── Google Workspace Commands ─────────────────────────────────────────────────

const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

function requireGoogle(ctx) {
  if (!GOOGLE_REFRESH_TOKEN) {
    ctx.reply("❌ Google Workspace not connected. Run npm run google:setup first.");
    return false;
  }
  return true;
}

bot.command("gdrive_sync", async (ctx) => {
  if (!requireGoogle(ctx)) return;
  await runSync(ctx, ["scripts/google-drive.js", "--sync-from-drive"], "Product Images (Drive → context/assets)");
});

bot.command("gcal", async (ctx) => {
  if (!requireGoogle(ctx)) return;
  await runSync(ctx, ["scripts/google-calendar.js", "--list", "--days", "30"], "Google Calendar");
});

bot.command("gcal_sync", async (ctx) => {
  if (!requireGoogle(ctx)) return;
  await runSync(ctx, ["scripts/google-calendar.js", "--sync-to-context"], "Google Calendar → Context");
});

bot.command("greviews", async (ctx) => {
  if (!requireGoogle(ctx)) return;
  await runSync(ctx, ["scripts/google-reviews.js", "--sync"], "Google Business Reviews");
});

bot.command("gmail", async (ctx) => {
  if (!requireGoogle(ctx)) return;
  await runSync(ctx, ["scripts/google-mail.js", "--list", "--count", "10"], "Gmail Inbox");
});

bot.command("gmail_report", async (ctx) => {
  if (!requireGoogle(ctx)) return;
  const filepath = ctx.message.text.replace(/^\/gmail_report\s*/i, "").trim();
  if (!filepath) return ctx.reply("Usage: /gmail_report [filepath]\n\nExample: /gmail_report report-potico-2026-03-19.md");
  await runSync(ctx, ["scripts/google-mail.js", "--send-report", filepath], "Email Report");
});

bot.command("save_ad", async (ctx) => {
  const entry = ctx.message.text.replace(/^\/save_ad\s*/i, "").trim();
  if (!entry) {
    return ctx.reply(
      "Usage: /save_ad [describe or paste the competitor ad]\n\n" +
        "Example:\n/save_ad Brand Name — \"Send love in a box\" — UGC hook showing unboxing, ran on FB+IG, high engagement"
    );
  }

  const file = path.join(CONTEXT_DIR, "meta", "ads-library.md");
  const date = new Date().toISOString().slice(0, 10);
  const line = `\n#### Manual Entry — ${date}\n${entry}\n`;

  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, "utf8");
    if (content.includes("## Manual Entries")) {
      fs.writeFileSync(file, content + line);
    } else {
      fs.writeFileSync(file, content + "\n---\n\n## Manual Entries\n" + line);
    }
  } else {
    fs.mkdirSync(path.join(CONTEXT_DIR, "meta"), { recursive: true });
    fs.writeFileSync(
      file,
      "# Ad Inspiration — Manual Entries\n\n## Manual Entries\n" + line
    );
  }

  ctx.reply("✅ Saved to inspiration library. Claude will use it next time you ask for hooks or copy.");
});

bot.command("gen_image", async (ctx) => {
  if (!GEMINI_API_KEY) {
    return ctx.reply("❌ GEMINI_API_KEY not set in .env — add your Google Gemini API key to enable image generation.");
  }

  const raw = ctx.message.text.replace(/^\/gen_image\s*/i, "").trim();
  if (!raw) {
    return ctx.reply(
      "Usage: /gen_image [ratio] [description]\n\n" +
        "Ratios: 1:1 (default), 4:3, 3:4, 9:16, 16:9\n\n" +
        "Examples:\n" +
        "/gen_image Mother's Day gift box, warm pastel tones, lifestyle\n" +
        "/gen_image 9:16 UGC-style unboxing video thumbnail, Filipino family"
    );
  }

  // Parse optional aspect ratio prefix — supports both "9:16 ..." and "[9:16] ..." formats
  const ratioMatch = raw.match(/^\[?(\d+:\d+)\]?\s*/);
  const aspectRatio =
    ratioMatch && ASPECT_RATIOS.includes(ratioMatch[1])
      ? ratioMatch[1]
      : "1:1";
  const rawDesc = ratioMatch ? raw.slice(ratioMatch[0].length).trim() : raw;
  const description = rawDesc.replace(/^\[|\]$/g, "").trim() || raw;

  const msg = await ctx.reply(`🎨 Generating ${aspectRatio} image...`);

  try {
    const optimizedPrompt = await buildImagePrompt(description);
    const imageBuffer = await generateImage(optimizedPrompt, aspectRatio);

    await ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
    await ctx.replyWithPhoto(
      { source: imageBuffer },
      {
        caption:
          `🎨 ${aspectRatio} — ${description.slice(0, 80)}${description.length > 80 ? "…" : ""}\n\n` +
          `Prompt: ${optimizedPrompt.slice(0, 200)}${optimizedPrompt.length > 200 ? "…" : ""}`,
      }
    );
  } catch (err) {
    await ctx.telegram
      .editMessageText(ctx.chat.id, msg.message_id, undefined, `❌ Image generation failed: ${err.message}`)
      .catch(() => ctx.reply(`❌ Image generation failed: ${err.message}`));
  }
});

bot.command("clear", (ctx) => {
  conversations.delete(ctx.chat.id);
  ctx.reply("🗑️ Conversation history cleared.");
});

// ── Message Handler ───────────────────────────────────────────────────────────

bot.on("text", async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text;

  if (!conversations.has(chatId)) conversations.set(chatId, []);
  const history = conversations.get(chatId);

  // Detect if this is a visual content creation request
  const targetRatio = detectPostPlatform(text);
  // Attach product images when user references them or asks for a visual post
  const wantsProductRef = /\b(product|reference|context.assets|ref.?image|product.?photo)\b/i.test(text);
  const shouldAttachImages = wantsProductRef || targetRatio !== null;

  // Store text-only in history (keeps history lean)
  history.push({ role: "user", content: text });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

  // For the Claude API call, optionally augment the last user message with product images
  let messagesForClaude = [...history];
  if (shouldAttachImages) {
    const imageBlocks = loadProductImageBlocks(2);
    if (imageBlocks.length > 0) {
      messagesForClaude = [
        ...history.slice(0, -1),
        { role: "user", content: [...imageBlocks, { type: "text", text }] },
      ];
    }
  }

  try {
    const response = await askClaude(ctx, messagesForClaude);
    history.push({ role: "assistant", content: response });
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);

    // Auto-generate the matching visual after copy is delivered
    if (targetRatio) {
      await autoGeneratePostImage(ctx, text, response, targetRatio);
    }
  } catch (err) {
    console.error("Error handling message:", err.message);
  }
});

// ── Launch ────────────────────────────────────────────────────────────────────

// Register all commands so they appear in the "/" autocomplete menu in Telegram
bot.telegram.setMyCommands([
  // ── Sync & Data ──────────────────────────────────────────────────────────
  { command: "sync_all",    description: "Sync all platforms at once" },
  { command: "sync_meta",   description: "Sync Facebook & Instagram performance" },
  { command: "sync_shopify",description: "Sync Shopify products, reviews, orders" },
  { command: "sync_google", description: "Sync Google Ads performance" },
  { command: "sync_tiktok", description: "Sync TikTok Ads performance" },
  { command: "sync_ads",    description: "Sync competitor & inspiration ads (Meta Ads Library)" },
  { command: "save_ad",     description: "Save a competitor ad manually: /save_ad [description]" },
  // ── Google Workspace ─────────────────────────────────────────────────────
  { command: "gdrive_sync", description: "Pull product images from Google Drive → context/assets" },
  { command: "gcal",        description: "Show upcoming Google Calendar events (30 days)" },
  { command: "gcal_sync",   description: "Sync Google Calendar to context files" },
  { command: "greviews",    description: "Sync Google Business Profile reviews to context" },
  { command: "gmail",       description: "List recent Gmail inbox messages" },
  { command: "gmail_report",description: "Email a report file: /gmail_report [filepath]" },
  // ── Image Generation ─────────────────────────────────────────────────────
  { command: "gen_image",   description: "Generate an image: /gen_image [1:1|9:16|16:9] [description]" },
  // ── Research & Strategy ──────────────────────────────────────────────────
  { command: "competitor_audit",   description: "Run a competitive creative audit on a DTC brand" },
  { command: "review_miner",       description: "Extract voice-of-customer insights from reviews" },
  { command: "audience_segments",  description: "Build micro-segments from Shopify purchase data (RFM)" },
  // ── Analytics & Optimization ─────────────────────────────────────────────
  { command: "report_writer",      description: "Write a weekly cross-channel performance report" },
  { command: "fatigue_detector",   description: "Flag fatiguing creatives with replacement suggestions" },
  { command: "performance_brief",  description: "Generate a data-driven creative brief from ad data" },
  { command: "creative_score",     description: "Score creative concepts against historical winners" },
  { command: "ab_test_plan",       description: "Design structured A/B test plans for creative elements" },
  // ── Creative Development ─────────────────────────────────────────────────
  { command: "brief_generator",    description: "Generate a creative brief (Meta, TikTok, Email, Pinterest)" },
  { command: "hook_writer",        description: "Write 15+ ad hooks and short-form video scripts" },
  { command: "ad_variations",      description: "Generate 10-20 ad copy variations from a winning ad" },
  { command: "tiktok_script",      description: "Write TikTok-native short-form video scripts" },
  { command: "email_writer",       description: "Write email campaigns and automation flows" },
  { command: "prompt_composer",    description: "Compose enhanced AI image generation prompts" },
  { command: "concept_planner",    description: "Plan a multi-concept campaign across formats and personas" },
  // ── Production ───────────────────────────────────────────────────────────
  { command: "static_ads",         description: "Create production-ready static ad layouts as HTML" },
  { command: "advertorial_builder",description: "Build a DR advertorial framework for your brand" },
  { command: "repurpose",          description: "Repurpose content into multi-platform assets" },
  // ── Workflow Automation ───────────────────────────────────────────────────
  { command: "weekly_creative_sprint", description: "Full weekly creative cycle: analyze, plan, produce" },
  // ── Utility ──────────────────────────────────────────────────────────────
  { command: "clear",   description: "Reset conversation history" },
  { command: "help",    description: "Show available commands" },
]).catch((err) => console.warn("⚠ Could not set bot commands:", err.message));

bot.launch();
console.log("🤖 Social Media Assistant is running on Telegram...");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
