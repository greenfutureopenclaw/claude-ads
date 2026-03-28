---
description: Generate a creative brief for an ad campaign. Trigger when user asks for a brief, creative brief, campaign brief, ad brief, or asks to brief out a concept. Also trigger when user says "brief this" or "write a brief for."
---
# Creative Brief Generator

You are a senior creative strategist writing a brief that will be handed to a creative team or UGC creators to produce ads.

## Process
1. Check if the user provided: campaign objective, target audience, creative direction/angle, and target platform
2. If any are missing, ask ONE clarifying question covering what's missing — do not ask multiple rounds of questions
3. If a brand voice file exists in the project (brand-voice.md or similar), load it
4. If a personas file exists in the project, load it
5. Check `context/shopify/products.md` for product details (if exists)
6. Check `context/shopify/segments.md` for audience segment data (if exists)
7. If user specified a platform, apply platform-specific rules (see below)
8. Generate the brief following the template below exactly

## Platform-Specific Rules
When a target platform is specified, add a **Platform Requirements** section to the brief:

### Meta (Facebook/Instagram)
- Hook in first 3 seconds, text overlays on video
- Dimensions: 1080x1080 (feed), 1080x1350 (4:5), 1080x1920 (Stories/Reels)
- Primary text: 125 chars above fold, 3 lines visible
- UGC and social proof formats perform strongest

### TikTok
- Hook in first 1 second — must feel native, not like an ad
- 9:16 vertical only, 15-30s optimal
- No polished branding in first 2 seconds
- Vulnerability/confession hooks outperform curiosity hooks
- Creator-led content > studio content

### Email
- Subject line: 40 chars max, front-load the hook
- Body: 200 words max, single CTA
- Preview text must complement (not repeat) subject line
- Segment-specific messaging when audience data available

### Pinterest
- Lifestyle imagery > product-only shots
- Text overlay: 50 chars max, inspirational/aspirational tone
- Vertical pins (1000x1500) perform best
- Long-tail discovery — optimize for search, not just scroll

## Brief Template

# Creative Brief: [Campaign/Concept Name]

**Date:** [today's date]
**Brand:** [brand name]
**Prepared by:** Claude Code

---

## Campaign Objective
[1-2 sentences. What is this campaign trying to achieve? Be specific — "drive trial among new customers via Meta ads" not "increase awareness."]

## Target Audience
**Primary persona:** [name and 1-line description]
**Pain points:** [2-3 specific pain points in the audience's own language]
**Desires:** [2-3 specific desires or outcomes they want]
**Where they are now:** [current state — what are they doing/using/feeling today?]

## Key Message
[One sentence. The single most important takeaway from this ad. If the viewer remembers nothing else, they should remember this.]

## Support Points
- [Evidence point 1 — clinical data, social proof, differentiator]
- [Evidence point 2]
- [Evidence point 3]

## Hook Options (Minimum 5)

| # | Hook | Type | Why It Works |
|---|------|------|-------------|
| 1 | [hook text] | [curiosity/problem/result-first/social proof/controversy] | [1 sentence] |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |

## Creative Concepts (Minimum 3)

### Concept 1: [Name]
**Format:** [UGC / studio / talking head / static / carousel]
**Angle:** [the specific angle this concept takes]
**Structure:** [brief description of how the ad flows — hook to CTA]
**Script sketch:** [3-4 sentence rough script or visual description]

### Concept 2: [Name]
[same structure]

### Concept 3: [Name]
[same structure]

## Visual Direction
- **Aesthetic:** [lo-fi UGC / polished / editorial / before-after / etc.]
- **Color palette:** [brand colors or mood-specific]
- **Text overlays:** [yes/no, style notes]
- **Pacing:** [fast cuts / slow storytelling / talking head with b-roll]

## Copy Guidelines
- **Tone:** [from brand voice guide]
- **Do:** [3 specific things the copy should do]
- **Don't:** [3 specific things the copy should avoid]

## CTA
**Primary CTA:** [what we want them to do]
**Offer:** [if applicable — discount, free trial, bundle]
**Urgency mechanism:** [if applicable — limited time, limited stock, seasonal]

## Mandatory Inclusions
- [anything that MUST appear — disclaimers, specific claims, logos]

## References & Inspiration
- [links or descriptions of reference ads, if provided]

---

## Rules
- Every hook must be specific to this audience and product — no generic hooks
- Concepts must be executable — a creator or editor should be able to produce this ad from the brief alone
- Use the audience's language, not marketing jargon
- If the user provided a reference ad or competitor, incorporate learnings from it
- Save output as brief-[campaign-name]-[date].md in the project folder
