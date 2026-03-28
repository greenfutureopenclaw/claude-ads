---
description: Detect creative fatigue in ad data. Trigger when user asks about creative fatigue, ad fatigue, declining ads, tired creatives, or says "which ads are dying" or "flag fatiguing ads." Also trigger when user provides time-series ad data and asks what needs refreshing.
---
# Creative Fatigue Detector

You catch creative fatigue early and recommend specific refresh actions before performance craters.

## Fatigue Signals
- **CTR decline:** 20%+ drop from peak over any 5-day window
- **Frequency creep:** above 2.5 and rising
- **CPA increase:** 25%+ from best CPA over any 5-day window
- **CVR decline:** conversion rate trending down, impressions stable
- **Spend shift:** platform moving spend away from this ad

## Fatigue Score
- 🟢 **Healthy** — stable or improving. No action.
- 🟡 **Early Warning** — one signal detected. Monitor daily.
- 🔴 **Fatigued** — multiple signals. Refresh within 48 hours.
- ⚫ **Dead** — severe decline across all metrics. Pause immediately.

## Output Format

# Creative Fatigue Report — [Brand]

**Period:** [date range]
**Ads analyzed:** [count]

## Summary
[How many healthy, how many need attention, overall creative health.]

## Priority Action

| Priority | Ad | Status | Signal | Days Declining | Action |
|----------|-----|--------|--------|---------------|--------|
| 1 | [ad] | 🔴 | [signal] | [days] | [action] |

## Full Analysis

### [Ad Name] — [🟢/🟡/🔴/⚫]

**Peak:** [best metrics, when]
**Current:** [current metrics]
**Signals:** [which triggered]
**Runway:** [estimated days remaining]
**Refresh recommendation:** [specific — new hook type, new visual, new angle, or full replacement]

### Replacement Format Suggestions
For each fatigued ad, suggest replacement formats from `context/ad-formats.json`:

| Fatigued Ad | Current Format | Suggested Replacement Format | Why |
|-------------|---------------|---------------------------|-----|
| [ad name] | [current format] | [suggested format from ad-formats.json] | [reasoning — e.g., "current mix is 60% UGC; test a static testimonial card to diversify"] |

**Format Mix Analysis:**
- Current running formats: [list each format type and count/percentage]
- Over-represented: [formats with >30% of mix]
- Under-represented: [formats with 0% or <10% of mix]
- Recommendation: [which format types to add for better diversification]

## Rules
- Be specific about what to refresh — "test a result-first hook instead of the current curiosity hook" not just "new creative"
- Show the data behind every assessment
- Conservative runway estimates — better to replace early
- Less than 7 days of data = flag as preliminary
- Save as fatigue-report-[brand]-[date].md in project folder
