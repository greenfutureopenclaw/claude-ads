#!/usr/bin/env node
/**
 * google-drive.js — Google Drive operations for creative asset management.
 *
 * Usage:
 *   node scripts/google-drive.js --list [--folder <id>]
 *   node scripts/google-drive.js --upload <filepath> [--folder <id>]
 *   node scripts/google-drive.js --sync-assets         # uploads context/assets/ to Drive
 *   node scripts/google-drive.js --download <fileId> [--out <path>]
 *   node scripts/google-drive.js --export-report <file> # upload a report markdown to Drive
 *   node scripts/google-drive.js --search <query>
 *
 * Requires .env:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
 *   GOOGLE_DRIVE_FOLDER_ID  (optional: default folder for uploads)
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { getAccessToken } = require("./google-auth");

const BASE_URL = "https://www.googleapis.com";
const CONTEXT_DIR = path.resolve(__dirname, "..", "context");
const ASSETS_DIR = path.join(CONTEXT_DIR, "assets");
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

function mimeForExt(ext) {
  const map = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".mp4": "video/mp4", ".mov": "video/quicktime",
    ".pdf": "application/pdf", ".zip": "application/zip",
    ".md": "text/markdown", ".txt": "text/plain",
    ".html": "text/html", ".json": "application/json",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return map[ext.toLowerCase()] || "application/octet-stream";
}

async function driveGet(token, path_, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${path_}${qs ? "?" + qs : ""}`;
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Drive API ${res.statusCode}: ${data.slice(0, 300)}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });
    req.on("error", reject);
  });
}

// ── Operations ────────────────────────────────────────────────────────────────

async function listFiles(token, folderId) {
  const query = folderId
    ? `'${folderId}' in parents and trashed=false`
    : "trashed=false";

  const result = await driveGet(token, "/drive/v3/files", {
    q: query,
    fields: "files(id,name,mimeType,size,modifiedTime,webViewLink)",
    orderBy: "modifiedTime desc",
    pageSize: "50",
  });

  const files = result.files || [];
  if (files.length === 0) {
    console.log("(no files found)");
    return;
  }

  console.log(`\n📁 Google Drive Files${folderId ? ` in folder ${folderId}` : ""}:\n`);
  for (const f of files) {
    const isFolder = f.mimeType === "application/vnd.google-apps.folder";
    const size = f.size ? ` (${formatSize(parseInt(f.size))})` : "";
    const date = f.modifiedTime ? ` — ${f.modifiedTime.slice(0, 10)}` : "";
    console.log(`  ${isFolder ? "📁" : "📄"} ${f.name}${size}${date}`);
    console.log(`     ID: ${f.id}  ${f.webViewLink || ""}`);
  }
  console.log(`\n${files.length} item(s)`);
}

async function searchFiles(token, query) {
  const result = await driveGet(token, "/drive/v3/files", {
    q: `name contains '${query}' and trashed=false`,
    fields: "files(id,name,mimeType,size,modifiedTime,webViewLink)",
    orderBy: "modifiedTime desc",
    pageSize: "20",
  });

  const files = result.files || [];
  console.log(`\n🔍 Search results for "${query}":\n`);
  for (const f of files) {
    const size = f.size ? ` (${formatSize(parseInt(f.size))})` : "";
    console.log(`  📄 ${f.name}${size}`);
    console.log(`     ID: ${f.id}  ${f.webViewLink || ""}`);
  }
  console.log(`\n${files.length} result(s)`);
}

async function uploadFile(token, filepath, folderId) {
  const filename = path.basename(filepath);
  const mime = mimeForExt(path.extname(filepath));
  const fileContent = fs.readFileSync(filepath);
  const boundary = "---GoogleDriveUpload" + Date.now();

  const parents = folderId ? [folderId] : (FOLDER_ID ? [FOLDER_ID] : []);
  const metadata = JSON.stringify({ name: filename, ...(parents.length ? { parents } : {}) });

  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),
    fileContent,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  return new Promise((resolve, reject) => {
    const req = https.request(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": body.length,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`Upload failed ${res.statusCode}: ${data.slice(0, 300)}`));
          } else {
            const file = JSON.parse(data);
            console.log(`  ✅ ${filename} → ${file.webViewLink || file.id}`);
            resolve(file);
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function syncAssets(token) {
  if (!fs.existsSync(ASSETS_DIR)) {
    console.log(`No assets directory found at ${ASSETS_DIR}`);
    return;
  }

  const files = fs.readdirSync(ASSETS_DIR).filter(f => !f.startsWith("."));
  if (files.length === 0) {
    console.log("No asset files to sync.");
    return;
  }

  console.log(`\n📤 Syncing ${files.length} assets to Google Drive...\n`);
  for (const file of files) {
    const filepath = path.join(ASSETS_DIR, file);
    if (fs.statSync(filepath).isFile()) {
      await uploadFile(token, filepath, FOLDER_ID);
    }
  }
  console.log("\n✅ Assets synced.");
}

async function syncAssetsFromDrive(token, folderId) {
  const targetFolder = folderId || FOLDER_ID;
  if (!targetFolder) {
    console.error("❌ No folder ID provided. Set GOOGLE_DRIVE_FOLDER_ID in .env or pass --folder <id>");
    process.exit(1);
  }

  const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);

  const result = await driveGet(token, "/drive/v3/files", {
    q: `'${targetFolder}' in parents and trashed=false`,
    fields: "files(id,name,mimeType,size,modifiedTime)",
    orderBy: "modifiedTime desc",
    pageSize: "100",
  });

  const files = (result.files || []).filter(f => IMAGE_TYPES.has(f.mimeType));

  if (files.length === 0) {
    console.log("(no image files found in folder)");
    return;
  }

  if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

  console.log(`\n📥 Syncing ${files.length} image(s) from Drive → context/assets/\n`);
  let synced = 0;
  let skipped = 0;

  for (const file of files) {
    const outPath = path.join(ASSETS_DIR, file.name);

    // Skip if already exists and size matches
    if (fs.existsSync(outPath) && file.size) {
      const localSize = fs.statSync(outPath).size;
      if (localSize === parseInt(file.size)) {
        console.log(`  ⏭  ${file.name} (unchanged)`);
        skipped++;
        continue;
      }
    }

    await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(outPath);
      https.get(
        `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
        { headers: { Authorization: `Bearer ${token}` } },
        (res) => {
          if (res.statusCode === 200) {
            res.pipe(fileStream);
            fileStream.on("finish", () => {
              fileStream.close();
              console.log(`  ✅ ${file.name} (${formatSize(parseInt(file.size || "0"))})`);
              synced++;
              resolve();
            });
          } else {
            let data = "";
            res.on("data", c => (data += c));
            res.on("end", () => reject(new Error(`Download failed ${res.statusCode}: ${data.slice(0, 200)}`)));
          }
        }
      ).on("error", reject);
    });
  }

  console.log(`\n✅ Done — ${synced} downloaded, ${skipped} unchanged. Assets at context/assets/`);
}

async function downloadFile(token, fileId, outPath) {
  return new Promise((resolve, reject) => {
    const outputPath = outPath || path.join(process.cwd(), fileId);
    const file = fs.createWriteStream(outputPath);

    https.get(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        if (res.statusCode === 200) {
          res.pipe(file);
          file.on("finish", () => {
            file.close();
            console.log(`✅ Downloaded to ${outputPath}`);
            resolve(outputPath);
          });
        } else {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => reject(new Error(`Download failed ${res.statusCode}: ${data.slice(0, 200)}`)));
        }
      }
    ).on("error", reject);
  });
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const flag = (f) => args.includes(f);
  const arg = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

  const token = await getAccessToken();

  if (flag("--list")) {
    await listFiles(token, arg("--folder"));
  } else if (flag("--search")) {
    await searchFiles(token, arg("--search") || args[args.indexOf("--search") + 1]);
  } else if (flag("--upload")) {
    const filepath = arg("--upload");
    if (!filepath) { console.error("Usage: --upload <filepath>"); process.exit(1); }
    if (!fs.existsSync(filepath)) { console.error(`File not found: ${filepath}`); process.exit(1); }
    console.log(`Uploading ${filepath}...`);
    await uploadFile(token, filepath, arg("--folder"));
  } else if (flag("--sync-assets")) {
    await syncAssets(token);
  } else if (flag("--export-report")) {
    const file = arg("--export-report");
    if (!file || !fs.existsSync(file)) { console.error("Report file not found"); process.exit(1); }
    console.log(`Exporting report ${file} to Drive...`);
    const result = await uploadFile(token, file, arg("--folder"));
    console.log(`\nReport available at: ${result.webViewLink}`);
  } else if (flag("--download")) {
    const fileId = arg("--download");
    if (!fileId) { console.error("Usage: --download <fileId>"); process.exit(1); }
    await downloadFile(token, fileId, arg("--out"));
  } else if (flag("--sync-from-drive")) {
    await syncAssetsFromDrive(token, arg("--folder"));
  } else {
    console.log(`
Google Drive CLI

Usage:
  node scripts/google-drive.js --list [--folder <folderId>]
  node scripts/google-drive.js --search <query>
  node scripts/google-drive.js --upload <filepath> [--folder <folderId>]
  node scripts/google-drive.js --sync-assets              # upload context/assets/ → Drive
  node scripts/google-drive.js --sync-from-drive [--folder <folderId>]  # download images from Drive → context/assets/
  node scripts/google-drive.js --download <fileId> [--out <path>]
  node scripts/google-drive.js --export-report <filepath>

Env: GOOGLE_DRIVE_FOLDER_ID (default folder for uploads and sync-from-drive)
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
