---
description: Read Gmail inbox and send emails — weekly reports, campaign briefs, performance summaries. Trigger when user says "send this report by email," "email the brief," "check my inbox," "send to the team," or asks to email any generated output. Also trigger on /google-mail.
disable-model-invocation: true
argument-hint: "[--list | --send | --send-report <file> | --search <query>]"
---
# Gmail

Read inbox and send emails directly from the creative workflow — useful for sending weekly reports, performance summaries, and creative briefs to clients or team members.

## Setup Check
Verify `.env` has `GOOGLE_REFRESH_TOKEN`. If missing: `node scripts/google-setup.js`

## Operations

### List recent inbox
```bash
node scripts/google-mail.js --list
node scripts/google-mail.js --list --count 20
```

### Read a specific message
```bash
node scripts/google-mail.js --read <messageId>
```

### Search inbox
```bash
node scripts/google-mail.js --search "subject:weekly report"
node scripts/google-mail.js --search "from:agency@example.com"
node scripts/google-mail.js --search "campaign brief"
```

### Send a quick email
```bash
node scripts/google-mail.js --send \
  --to "client@example.com" \
  --subject "Weekly Creative Report — March 2026" \
  --body "Hi, please find this week's performance summary attached."
```

### Email a generated report file
```bash
node scripts/google-mail.js --send-report report-potico-2026-03-19.md \
  --to "team@example.com"
```
The report is formatted as readable HTML and sent as the email body.

## Env Variables
- `GOOGLE_MAIL_DEFAULT_TO` — Default recipient for `--send-report` (optional). Set to your client or team email so you can skip `--to` each time.

## Common Workflow
After running `/report-writer`:
```bash
node scripts/google-mail.js --send-report report-potico-2026-03-19.md
```
Or push to Drive first, then email the link:
```bash
node scripts/google-drive.js --export-report report-potico-2026-03-19.md
# copy the Drive link, then:
node scripts/google-mail.js --send --to "client@example.com" \
  --subject "Weekly Report" --body "Drive link: https://..."
```
