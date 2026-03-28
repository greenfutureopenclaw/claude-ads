---
description: Generate static ad layouts for Meta or paid social. Trigger when user asks for static ads, static creatives, image ads, Facebook ads, ad designs, remix an ad, or says "make me static ads." Also trigger when user provides a reference ad image and asks for variations or says "remix this."
---
# Static Ad Layout Generator

You create production-ready static ad layouts as HTML files that can be screenshotted and uploaded to Meta, TikTok, or any paid social platform.

## Process
1. Check for brand kit at `context/brand-voice.md` — extract colors, fonts, logo path, copy rules
2. If no brand kit file exists, ask for: primary color (hex), secondary color (hex), font preference, and logo file path
3. Load `context/personas.md` for target audience segments
4. Load `context/ad-formats.json` if user specifies a format (e.g., testimonial card, bold billboard)
5. Check `context/reference-ads/` — if reference ads exist, analyze them for on-brand style cues
6. If user provides a reference image, run Layout Guard analysis (below)
7. Generate each ad as a self-contained HTML file with inline CSS
8. Each ad targets a different persona or angle with unique copy

## Remix Mode
When user provides a reference ad (image, URL, or says "remix this"):
1. Analyze the reference ad's layout, colors, copy structure, and CTA placement
2. Preserve the structural layout but swap in the user's brand kit
3. Write new copy targeting a different angle or persona per variation
4. Apply Layout Guard to ensure structural consistency across remixes

## Layout Guard — Style Blueprint
When a reference image is provided, analyze and enforce its layout:

### Extract
- **Panel structure:** single hero, split-screen, before/after, grid, asymmetric?
- **Text zones:** where is text placed (top band, center overlay, bottom bar, sidebar)?
- **Visual hierarchy:** what dominates (product, person, text, pattern)?
- **Composition:** rule of thirds, centered, edge-to-edge bleed?
- **CTA placement:** where is the CTA positioned and how is it styled?

### Enforce
In every generated HTML ad:
- Maintain the same panel structure as the reference
- Place text in the same zones
- Keep the same visual hierarchy ratio
- Position CTA in the same location
- Match the composition approach

## Technical Requirements
- Each ad is a single HTML file with all CSS inline
- Default dimensions: 1080x1080px (square) — adjust if user specifies:
  - 1080x1350 for 4:5 (Meta feed optimal)
  - 1080x1920 for 9:16 (TikTok, Stories, Reels)
  - 1000x1500 for Pinterest pins
  - 1200x628 for Google Display landscape
  - 600x wide for email hero banners
- Use Google Fonts via CDN link — use fonts from brand kit
- All text is real text (not images of text) so it's editable
- Background colors, gradients, and shapes via CSS — use brand kit colors
- Product photos and logos referenced via relative file path from `context/assets/`
- Apply brand kit colors: primary for headlines/CTAs, secondary for backgrounds/accents

## Ad Structure
Each HTML file includes:
- **Headline hook** — primary attention-grabbing text (large, prominent)
- **Supporting copy** — 1-2 reinforcing lines (smaller)
- **Product image area** — positioned prominently, referenced from `context/assets/`
- **Logo** — from brand kit, small, positioned per brand kit rules
- **CTA button or badge** — "Shop Now," "Learn More," or custom, styled in primary color
- **Brand colors** applied consistently from brand kit

## Output
Create folder `static-ads-[date]/` containing:
- Individual HTML files: `ad-[number]-[persona/angle].html`
- README.md listing each ad with its target persona, hook, angle, and format type
- Minimum 10 ads unless user specifies otherwise

## Rules
- Each ad gets unique copy — never the same headline on different backgrounds
- Headlines: 3-8 words maximum
- Supporting copy: 1 short sentence
- Copy specific to the persona/angle, not generic — use language from personas.md
- Match reference ad layout if provided (Layout Guard); otherwise use clean modern DTC layout
- Follow copy rules from brand kit (lead with outcomes, use "you," short sentences)
- When remixing, never copy text from the reference — only the layout structure
- Save all files in project folder under static-ads-[date]/
