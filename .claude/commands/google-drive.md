---
description: Manage files in Google Drive — upload ad assets, download files, sync brand assets, export reports. Trigger when user says "upload to drive," "export to drive," "sync assets to drive," "share this report," "save to google drive," or asks to manage files in Drive. Also trigger on /google-drive.
disable-model-invocation: true
argument-hint: "[--list | --upload <file> | --sync-assets | --export-report <file> | --search <query>]"
---
# Google Drive

Manage files in Google Drive for asset storage, report sharing, and team collaboration.

## Setup Check
First verify `.env` has `GOOGLE_REFRESH_TOKEN`. If missing: `node scripts/google-setup.js`

## Operations

### List files
```bash
node scripts/google-drive.js --list
# List a specific folder:
node scripts/google-drive.js --list --folder <folderId>
```

### Upload a file
```bash
node scripts/google-drive.js --upload <filepath>
# To a specific folder:
node scripts/google-drive.js --upload <filepath> --folder <folderId>
```

### Sync brand assets (context/assets/ → Drive)
```bash
node scripts/google-drive.js --sync-assets
```

### Export a report
```bash
node scripts/google-drive.js --export-report <report-file.md>
```
Returns a shareable Drive link.

### Search
```bash
node scripts/google-drive.js --search "q4 campaign"
```

### Download
```bash
node scripts/google-drive.js --download <fileId> --out ./local-name.pdf
```

## Env Variables
- `GOOGLE_DRIVE_FOLDER_ID` — Default upload folder (optional). Set to your brand assets folder ID.

## Tips
- After `/report-writer` generates a report, use `--export-report` to push it to Drive
- Use `--sync-assets` after adding new images to `context/assets/`
- Folder IDs appear in the Drive URL: `drive.google.com/drive/folders/<ID>`
