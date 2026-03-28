#!/usr/bin/env node

/**
 * Shopify Sync — Pulls products, reviews, and orders into context files
 * for use by creative skills (/review-miner, /brief-generator, /report-writer).
 *
 * Usage:
 *   node shopify/sync.js [--products] [--reviews] [--orders] [--all]
 *
 * Requires .env with:
 *   SHOPIFY_STORE_DOMAIN=your-actual-store.myshopify.com  ← check Settings > Domains
 *   SHOPIFY_CLIENT_ID=your-client-id
 *   SHOPIFY_CLIENT_SECRET=shpss_xxxxx
 *
 * Token is auto-fetched on each sync (expires every 24h).
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// Load .env manually (no extra dependency)
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const STORE = process.env.SHOPIFY_STORE_DOMAIN;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const CONTEXT_DIR = path.resolve(__dirname, "..", "context");
const SHOPIFY_DIR = path.resolve(CONTEXT_DIR, "shopify");

if (!STORE) {
  console.error(
    "Missing Shopify credentials in .env. Required:\n" +
    "  SHOPIFY_STORE_DOMAIN=your-store.myshopify.com\n" +
    "  SHOPIFY_ACCESS_TOKEN=shpat_xxxxx OR SHOPIFY_CLIENT_ID & SECRET"
  );
  process.exit(1);
}

if (!ACCESS_TOKEN && (!CLIENT_ID || !CLIENT_SECRET)) {
  console.error(
    "Missing Shopify token or credentials. Required:\n" +
    "  SHOPIFY_ACCESS_TOKEN=shpat_xxxxx (Recommended for Custom Apps)\n" +
    "OR\n" +
    "  SHOPIFY_CLIENT_ID=your-client-id\n" +
    "  SHOPIFY_CLIENT_SECRET=shpss_xxxxx"
  );
  process.exit(1);
}

function getAccessToken() {
  if (ACCESS_TOKEN) return Promise.resolve(ACCESS_TOKEN);

  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }).toString();

    const req = https.request(
      {
        hostname: STORE,
        path: "/admin/oauth/access_token",
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`Token request failed ${res.statusCode}: ${data.slice(0, 500)}`));
          } else {
            const parsed = JSON.parse(data);
            if (!parsed.access_token) {
              reject(new Error(`No access_token in response: ${data.slice(0, 300)}`));
            } else {
              resolve(parsed.access_token);
            }
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

let TOKEN = null;

function shopifyGet(endpoint) {
  return new Promise((resolve, reject) => {
    const url = `https://${STORE}/admin/api/2024-01/${endpoint}`;
    const req = https.request(
      url,
      {
        headers: {
          "X-Shopify-Access-Token": TOKEN,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(
              new Error(`Shopify API ${res.statusCode}: ${data.slice(0, 200)}`)
            );
          } else {
            resolve(JSON.parse(data));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

async function fetchAllPages(endpoint, resourceKey) {
  let results = [];
  let url = `${endpoint}?limit=250`;

  while (url) {
    const data = await shopifyGet(url);
    results = results.concat(data[resourceKey] || []);

    // Check for pagination via Link header (simplified — works for most cases)
    url = null;
    if (data[resourceKey] && data[resourceKey].length === 250) {
      const lastId = data[resourceKey][data[resourceKey].length - 1].id;
      url = `${endpoint}?limit=250&since_id=${lastId}`;
    }
  }

  return results;
}

async function syncProducts() {
  console.log("Fetching products...");
  const products = await fetchAllPages("products.json", "products");

  const catalog = products.map((p) => ({
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: p.body_html
      ? p.body_html.replace(/<[^>]+>/g, " ").trim()
      : "",
    product_type: p.product_type,
    tags: p.tags,
    vendor: p.vendor,
    variants: (p.variants || []).map((v) => ({
      title: v.title,
      price: v.price,
      compare_at_price: v.compare_at_price,
      sku: v.sku,
      inventory_quantity: v.inventory_quantity,
    })),
    images: (p.images || []).map((img) => img.src),
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));

  // Save JSON for programmatic use
  fs.writeFileSync(
    path.join(SHOPIFY_DIR, "products.json"),
    JSON.stringify(catalog, null, 2)
  );

  // Save markdown for AI context
  let md = `# Product Catalog\n\n`;
  md += `**Synced:** ${new Date().toISOString().split("T")[0]}\n`;
  md += `**Products:** ${catalog.length}\n\n`;

  for (const p of catalog) {
    const price = p.variants[0]?.price || "N/A";
    const comparePrice = p.variants[0]?.compare_at_price;
    md += `## ${p.title}\n`;
    md += `**Price:** $${price}`;
    if (comparePrice) md += ` (was $${comparePrice})`;
    md += `\n`;
    if (p.product_type) md += `**Type:** ${p.product_type}\n`;
    if (p.tags) md += `**Tags:** ${p.tags}\n`;
    if (p.description) md += `\n${p.description.slice(0, 500)}\n`;
    md += `\n---\n\n`;
  }

  fs.writeFileSync(path.join(SHOPIFY_DIR, "products.md"), md);
  console.log(`  Synced ${catalog.length} products`);
}

async function syncOrders() {
  console.log("Fetching orders (last 60 days)...");
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const data = await shopifyGet(
    `orders.json?limit=250&status=any&created_at_min=${since}`
  );
  const orders = data.orders || [];

  // Aggregate metrics
  const totalRevenue = orders.reduce(
    (sum, o) => sum + parseFloat(o.total_price || 0),
    0
  );
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Weekly breakdown
  const weeks = {};
  for (const o of orders) {
    const d = new Date(o.created_at);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const key = weekStart.toISOString().split("T")[0];
    if (!weeks[key]) weeks[key] = { orders: 0, revenue: 0 };
    weeks[key].orders++;
    weeks[key].revenue += parseFloat(o.total_price || 0);
  }

  // Top products by order frequency
  const productCounts = {};
  for (const o of orders) {
    for (const item of o.line_items || []) {
      const name = item.title;
      if (!productCounts[name])
        productCounts[name] = { count: 0, revenue: 0 };
      productCounts[name].count += item.quantity;
      productCounts[name].revenue += parseFloat(item.price) * item.quantity;
    }
  }
  const topProducts = Object.entries(productCounts)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 20);

  // Save JSON
  fs.writeFileSync(
    path.join(SHOPIFY_DIR, "orders.json"),
    JSON.stringify(
      {
        synced: new Date().toISOString(),
        period: `last 60 days`,
        total_orders: totalOrders,
        total_revenue: totalRevenue.toFixed(2),
        avg_order_value: avgOrderValue.toFixed(2),
        weekly: weeks,
        top_products: Object.fromEntries(topProducts),
      },
      null,
      2
    )
  );

  // Save markdown for report-writer
  let md = `# Shopify Sales Data\n\n`;
  md += `**Synced:** ${new Date().toISOString().split("T")[0]}\n`;
  md += `**Period:** Last 60 days\n\n`;
  md += `## Summary\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total Orders | ${totalOrders} |\n`;
  md += `| Total Revenue | $${totalRevenue.toFixed(2)} |\n`;
  md += `| Avg Order Value | $${avgOrderValue.toFixed(2)} |\n\n`;

  md += `## Weekly Breakdown\n\n`;
  md += `| Week Starting | Orders | Revenue |\n|--------------|--------|--------|\n`;
  for (const [week, data] of Object.entries(weeks).sort()) {
    md += `| ${week} | ${data.orders} | $${data.revenue.toFixed(2)} |\n`;
  }

  md += `\n## Top Products by Revenue\n\n`;
  md += `| Product | Units Sold | Revenue |\n|---------|-----------|--------|\n`;
  for (const [name, data] of topProducts) {
    md += `| ${name} | ${data.count} | $${data.revenue.toFixed(2)} |\n`;
  }

  fs.writeFileSync(path.join(SHOPIFY_DIR, "orders.md"), md);
  console.log(`  Synced ${totalOrders} orders`);
}

async function syncReviews() {
  console.log("Fetching product reviews...");

  // Try Shopify Product Reviews app (metafields) first,
  // then fall back to Judge.me / Stamped / Loox if available
  let allReviews = [];

  // Approach 1: Shopify metafields (native reviews)
  try {
    const products = await fetchAllPages("products.json", "products");
    for (const product of products.slice(0, 50)) {
      // rate-limit friendly
      try {
        const meta = await shopifyGet(
          `products/${product.id}/metafields.json`
        );
        const reviewField = (meta.metafields || []).find(
          (m) =>
            m.namespace === "reviews" ||
            m.namespace === "spr" ||
            m.key === "reviews"
        );
        if (reviewField) {
          const parsed =
            typeof reviewField.value === "string"
              ? JSON.parse(reviewField.value)
              : reviewField.value;
          if (Array.isArray(parsed)) {
            allReviews.push(
              ...parsed.map((r) => ({
                product: product.title,
                ...r,
              }))
            );
          }
        }
      } catch {
        // metafield parse error — skip
      }
    }
  } catch (err) {
    console.log(`  Metafields approach: ${err.message}`);
  }

  // Approach 2: Judge.me public API (common Shopify reviews app)
  if (allReviews.length === 0 && process.env.JUDGEME_API_TOKEN) {
    try {
      const domain = STORE.replace(".myshopify.com", "");
      const data = await new Promise((resolve, reject) => {
        https.get(
          `https://judge.me/api/v1/reviews?api_token=${process.env.JUDGEME_API_TOKEN}&shop_domain=${STORE}&per_page=100`,
          (res) => {
            let body = "";
            res.on("data", (c) => (body += c));
            res.on("end", () => resolve(JSON.parse(body)));
            res.on("error", reject);
          }
        );
      });
      allReviews = (data.reviews || []).map((r) => ({
        product: r.product_title,
        author: r.reviewer?.name || "Anonymous",
        rating: r.rating,
        title: r.title,
        body: r.body,
        date: r.created_at,
      }));
    } catch (err) {
      console.log(`  Judge.me: ${err.message}`);
    }
  }

  if (allReviews.length === 0) {
    console.log(
      "  No reviews found via metafields or Judge.me. If you use a reviews app (Stamped, Loox, Yotpo), export reviews as CSV and run /review-miner directly."
    );

    // Create a helpful placeholder
    fs.writeFileSync(
      path.join(SHOPIFY_DIR, "reviews.md"),
      `# Customer Reviews\n\n**Status:** No reviews synced yet.\n\n## How to Import Reviews\n\n1. **Judge.me** — Add JUDGEME_API_TOKEN to .env and re-run sync\n2. **Stamped / Loox / Yotpo** — Export reviews as CSV, then run \`/review-miner\` with the CSV\n3. **Shopify native** — Reviews stored in metafields are pulled automatically\n4. **Manual** — Paste reviews directly when using \`/review-miner\`\n`
    );
    return;
  }

  // Save reviews
  fs.writeFileSync(
    path.join(SHOPIFY_DIR, "reviews.json"),
    JSON.stringify(allReviews, null, 2)
  );

  let md = `# Customer Reviews\n\n`;
  md += `**Synced:** ${new Date().toISOString().split("T")[0]}\n`;
  md += `**Total Reviews:** ${allReviews.length}\n\n`;

  for (const r of allReviews.slice(0, 200)) {
    md += `### ${r.product || "Unknown Product"}`;
    if (r.rating) md += ` — ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}`;
    md += `\n`;
    if (r.author) md += `**By:** ${r.author}\n`;
    if (r.title) md += `**Title:** ${r.title}\n`;
    if (r.body) md += `\n> ${r.body.replace(/\n/g, "\n> ")}\n`;
    md += `\n---\n\n`;
  }

  fs.writeFileSync(path.join(SHOPIFY_DIR, "reviews.md"), md);
  console.log(`  Synced ${allReviews.length} reviews`);
}

async function main() {
  const args = process.argv.slice(2);
  const syncAll =
    args.includes("--all") || args.length === 0;
  const doProducts = syncAll || args.includes("--products");
  const doOrders = syncAll || args.includes("--orders");
  const doReviews = syncAll || args.includes("--reviews");

  console.log("Authenticating with Shopify...");
  TOKEN = await getAccessToken();
  console.log("  Auth OK\n");

  // Ensure output directory
  if (!fs.existsSync(SHOPIFY_DIR)) {
    fs.mkdirSync(SHOPIFY_DIR, { recursive: true });
  }

  console.log(`Syncing from ${STORE}...\n`);

  try {
    if (doProducts) await syncProducts();
    if (doOrders) await syncOrders();
    if (doReviews) await syncReviews();
    console.log("\nSync complete! Files saved to context/shopify/");
  } catch (err) {
    console.error(`\nSync failed: ${err.message}`);
    process.exit(1);
  }
}

main();
