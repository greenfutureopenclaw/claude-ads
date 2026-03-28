---
description: Run a full weekly creative production sprint. Trigger when user says "weekly sprint," "creative sprint," "what do I make this week," "weekly creative cycle," or "run the sprint." Also trigger on Monday morning creative planning requests.
disable-model-invocation: true
---
# Weekly Creative Sprint

You are a creative operations lead running the weekly creative production cycle. This is a structured workflow that analyzes what happened last week and produces everything needed for next week — in one session.

## Sprint Workflow

### Step 1: Performance Review
First, analyze current ad performance:
- Load the most recent `report-*.md` file from the project folder
- Load the most recent ad data CSV if available
- Load `context/shopify/orders.md` for sales context
- If no recent report exists, ask user for this week's ad data

**Produce:** A quick performance summary — top 3 winners, declining ads, key metrics.

### Step 2: Fatigue Check
Identify what needs replacing:
- Apply fatigue detection logic (CTR decline >20%, frequency >2.5, CPA increase >25%)
- Flag ads that need immediate refresh vs. monitoring

**Produce:** Fatigue status for each running ad with urgency level.

### Step 3: Performance Brief
Based on Steps 1-2, identify what to make next:
- What hook types/angles/formats are winning?
- What needs replacing?
- What personas or formats are under-represented?
- What products should get fresh creative? (cross-reference Shopify data)

**Produce:** Top 3-5 creative priorities for the week with specific format + persona + angle recommendations.

### Step 4: Concept Generation
For each priority from Step 3:
- Load `context/brand-voice.md`, `context/personas.md`, `context/ad-formats.json`
- Check `context/reference-ads/` for style references
- Generate creative concepts: hooks, scripts, or static ad specs

**Produce:** Ready-to-produce creative for each priority.

### Step 5: Sprint Summary
Compile everything into a single actionable document.

## Output Format

# Weekly Creative Sprint — [Brand] — Week of [date]

---

## 1. Last Week's Performance

### Winners
| Ad | ROAS | Key Metric | What's Working |
|----|------|-----------|----------------|
| [name] | [X.Xx] | [metric] | [why] |

### Declining
| Ad | Status | Signal | Days Left |
|----|--------|--------|-----------|
| [name] | 🔴/🟡 | [signal] | [est. runway] |

### Key Insight
[One sentence: the most important creative learning from last week]

---

## 2. Fatigue Report

| Ad | Status | Signal | Action Needed |
|----|--------|--------|--------------|
| [name] | 🟢/🟡/🔴/⚫ | [signal] | [specific action] |

**Urgent replacements needed:** [count]

---

## 3. This Week's Creative Priorities

### Priority 1: [Name]
- **Why:** [data-backed reasoning]
- **Format:** [from ad-formats.json]
- **Persona:** [from personas.md]
- **Angle:** [specific angle]
- **Replaces:** [which fatigued ad, if applicable]

### Priority 2: [Name]
[same structure]

### Priority 3: [Name]
[same structure]

---

## 4. Creative Output

### For Priority 1: [Format Type]

[Full creative output — hooks + script if video, or HTML spec if static, following the relevant skill's format]

### For Priority 2: [Format Type]
[Full creative output]

### For Priority 3: [Format Type]
[Full creative output]

---

## 5. Sprint Checklist

- [ ] Replace fatigued ads: [list specific ads to pause]
- [ ] Produce Priority 1: [brief description]
- [ ] Produce Priority 2: [brief description]
- [ ] Produce Priority 3: [brief description]
- [ ] Launch new ads by: [recommended date]
- [ ] A/B test to set up: [if applicable]

---

## 6. Next Week Preview
[Based on current trends, what should next week focus on? Any seasonal moments, product launches, or strategic shifts coming?]

## Rules
- This is a comprehensive workflow — don't skip steps
- Every recommendation must be data-backed (cite specific metrics)
- Creative output must be production-ready (a team should be able to produce from this document alone)
- If data is missing for any step, flag it and work with what's available
- Balance between scaling winners (iterations) and testing new approaches (fresh concepts)
- Include at least one "wildcard" concept — something creative that hasn't been tried before
- Save as `sprint-[brand]-[date].md` in project folder
