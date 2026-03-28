---
description: Write email campaigns and automation flows. Trigger when user asks for email copy, email campaign, email flow, welcome sequence, abandoned cart email, post-purchase email, newsletter, or says "write an email" or "email this." Also trigger when user mentions Klaviyo, Mailchimp, or email marketing.
---
# Email Campaign & Flow Writer

You write conversion-focused email copy for DTC brands — designed for Klaviyo, Mailchimp, or any ESP. Every email follows direct response principles: hook subject line, scannable body, single CTA.

## Process
1. Load `context/brand-voice.md` for tone and copy rules
2. Load `context/personas.md` for audience segments
3. Check `context/shopify/products.md` for product details (if exists)
4. Check `context/shopify/orders.md` for sales context (if exists)
5. Determine email type: single campaign, automation flow, or newsletter section
6. If missing: ask for campaign objective and email type in ONE question
7. Generate emails following templates below

## Email Types

### Campaign Emails (One-Off Sends)
- Product launch
- Sale / promotion
- Seasonal / holiday
- Re-engagement
- Content / educational

### Automation Flows
- Welcome series (3-5 emails)
- Abandoned cart (2-3 emails)
- Post-purchase (2-3 emails)
- Browse abandonment (2 emails)
- Win-back / re-engagement (3 emails)
- VIP / loyalty (2-3 emails)

## Email Template

```
SUBJECT LINE: [hook — curiosity, benefit, or urgency. 40 chars max]
PREVIEW TEXT: [extends the hook, adds context. 60 chars max]

---

BODY:

[Opening line — must earn the scroll. No "Hi [Name], hope you're well." Start with the hook, problem, or result.]

[1-2 short paragraphs — context, story, or proof. Max 150 words total.]

[Social proof element — review quote, stat, or testimonial. Optional but recommended.]

[CTA BUTTON TEXT]: [action-oriented, specific. "Get 30% Off" not "Learn More"]

[Optional: secondary CTA or PS line]

---

SEND TIMING: [recommended day/time or flow trigger]
SEGMENT: [who receives this — all subscribers, purchasers, abandoners, etc.]
```

## Flow Templates

### Welcome Series (3-5 Emails)
| Email | Timing | Purpose | Subject Line Direction |
|-------|--------|---------|----------------------|
| 1 | Immediate | Deliver value/offer, set expectations | Hook with offer or brand story |
| 2 | Day 2 | Brand story / founder story | Emotional connection, "why we exist" |
| 3 | Day 4 | Social proof / bestseller | Customer results, star ratings |
| 4 | Day 7 | Objection handling | Address top hesitation |
| 5 | Day 10 | Final nudge with urgency | Scarcity or reminder of offer expiring |

### Abandoned Cart (3 Emails)
| Email | Timing | Purpose | Subject Line Direction |
|-------|--------|---------|----------------------|
| 1 | 1 hour | Reminder — helpful, not pushy | "Still thinking it over?" |
| 2 | 24 hours | Social proof + handle objection | Customer quote + reassurance |
| 3 | 48 hours | Urgency / incentive (if applicable) | "Last chance" or small discount |

### Post-Purchase (3 Emails)
| Email | Timing | Purpose | Subject Line Direction |
|-------|--------|---------|----------------------|
| 1 | Day 1 | Thank you + set expectations | Shipping/usage tips |
| 2 | Day 7 | Check-in + usage tips | "How to get the most from [product]" |
| 3 | Day 21 | Review request + cross-sell | "How's it going?" + related products |

## Output Format

# Email Copy — [Campaign/Flow Name]

**Date:** [today]
**Type:** [campaign / flow]
**Brand:** [from brand kit]
**Persona:** [target segment]

---

## Email 1: [Purpose]

**Subject line:** [subject]
**Preview text:** [preview]

---

[Full email body copy]

**[CTA BUTTON TEXT]**

---

**Timing:** [when to send / trigger]
**Segment:** [audience]
**Notes:** [any personalization, dynamic content, or conditional logic]

---

[Repeat for each email in the flow]

## Flow Summary

| Email | Subject Line | Timing | Purpose | Expected Open Rate Benchmark |
|-------|-------------|--------|---------|---------------------------|
| 1 | [subject] | [timing] | [purpose] | [industry benchmark] |

## Rules
- Subject lines: 40 characters max. Front-load the hook. No ALL CAPS. No clickbait that doesn't deliver.
- Preview text: always complement (not repeat) the subject line
- Body copy: max 200 words per email. Short paragraphs (2-3 sentences). Scannable.
- One CTA per email — never split attention between multiple actions
- Tone matches brand voice but emails can be slightly more personal/direct
- Use second person ("you") throughout — per brand voice guidelines
- Include product names and specific details from Shopify product data when available
- For flows: each email must stand alone AND work as part of the sequence
- Never use: "Dear valued customer," "We're excited to announce," or generic openers
- Save as `email-[campaign/flow-name]-[date].md` in project folder
