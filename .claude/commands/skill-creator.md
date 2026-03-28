---
description: Create, improve, test, and optimize skills (slash commands) for this social media creative workflow. Use this skill when the user wants to build a new slash command from scratch, improve or edit an existing command, run test cases to verify a skill works, benchmark skill performance, or optimize a skill's description for better triggering. Also trigger when the user says "make a skill for X", "add a command for Y", "let's build a skill", "improve this command", or "test whether /X is working". Use proactively when the user describes a repeatable workflow they keep doing manually.
---

# Skill Creator — Social Media Workflow Edition

A meta-skill for building and improving the slash commands in this project. Skills live in `.claude/commands/*.md` — each is a markdown file with a YAML `description:` header and plain-English instructions for Claude.

## Quick Reference: What You're Building

```
.claude/commands/
├── skill-name.md        ← The skill (YAML frontmatter + instructions)
evals/
└── skill-name/
    ├── evals.json       ← Test prompts and assertions
    └── iteration-N/
        ├── eval-0/
        │   ├── with_skill/     output from Claude + skill
        │   ├── without_skill/  baseline output
        │   └── eval_metadata.json
        └── benchmark.json
```

---

## Stage 1: Understand What the User Wants

Figure out where the user is and jump in:

- **"Make a skill for X"** → go to capturing intent
- **"Improve /command-name"** → load the existing command, go to running evals
- **"Test whether /X works"** → load the skill, go straight to spawning runs
- **"Just vibe with me"** → write a draft, skip formal evals, iterate conversationally

### Capture Intent

Ask only what you need — don't interrogate. Extract answers from the conversation first.

1. What should this skill enable Claude to do in a social media context?
2. When should it trigger? (What user phrases/contexts should activate it?)
3. What format should the output be? (Markdown, HTML, JSON, saved file?)
4. Should we run test cases? Skills with objective outputs (sync scripts, reports, structured data) benefit from evals. Skills with subjective outputs (hooks, copy, concepts) are better reviewed qualitatively.

### Two Skill Categories — Know Which You're Building

**Capability uplift skills** teach Claude a technique it doesn't do consistently:
- `/static-ads` — knows HTML ad layout rules
- `/audience-segments` — knows RFM analysis methodology
- `/advertorial-builder` — knows DR advertorial structure

These benefit most from evals — you can verify the output structure is correct.

**Encoded preference skills** sequence existing capabilities in the team's preferred order:
- `/weekly-creative-sprint` — runs multiple steps in a specific workflow
- `/performance-brief` — pulls specific data before writing
- `/concept-planner` — follows a particular planning structure

These benefit from qualitative review — the question is "does this feel right?" not "did it pass?"

---

## Stage 2: Write the Skill

### Skill Format

Skills live in `.claude/commands/<skill-name>.md` (simple) or `.claude/skills/<skill-name>/SKILL.md` (directory format with supporting files). Both work the same way.

```markdown
---
description: [When to trigger + what it does. Be specific and pushy — Claude undertriggers by default. Include the slash command name AND natural-language phrasings.]
disable-model-invocation: true   # add for sync/deploy commands you want manual-only
allowed-tools: Read, Bash        # optional: restrict tools for safety/speed
argument-hint: "[platform]"      # optional: shown in autocomplete
context: fork                    # optional: run in isolated subagent
---

# Skill Name

[Instructions for Claude]
```

**Key frontmatter options:**
- `disable-model-invocation: true` — Sync scripts, deploys, anything with side effects. Claude won't auto-trigger it.
- `allowed-tools: Read, Grep` — Restrict Claude to specific tools for this skill
- `argument-hint: "[arg]"` — When the skill takes a user argument (e.g., `/hook-writer meta`)
- `context: fork` — Runs in an isolated subagent; great for long research tasks that shouldn't pollute conversation context
- `user-invocable: false` — Background reference material (not a user-facing command)

**Dynamic context injection** — use `!`command`` to inject live data before Claude processes the skill:
```markdown
## Today's performance
!`cat context/meta/performance.md | head -60`
!`cat context/shopify/orders.md | head -30`
```
Claude sees the actual file contents. Good for skills that need always-fresh context without manual loading instructions.

**Keep it under 500 lines.** If it's getting long, split into a main file + `references/` subfolder with `references/platform-specific.md` etc.

**Description field rules:**
- Include the slash command AND natural-language triggers
- Be specific about WHEN to use it, not just WHAT it does
- Add "use this even if the user doesn't say [command name] but says X" — this combats undertriggering
- Don't put "when to use" logic in the body — only in the description

**Explain the why.** Don't write `ALWAYS use this format`. Write *why* the format matters. Claude is smart and responds better to reasoning than to rigid mandates.

**Reference context files.** This project has rich context in `context/`:
- `context/brand-voice.md` — brand identity
- `context/personas.md` — audience segments
- `context/shopify/products.md` — catalog
- `context/shopify/reviews.md` — customer language
- `context/ad-formats.json` — 20 platform-specific ad formats
- `context/meta/performance.md`, `context/google-ads/performance.md`, etc.

Tell skills which context files to load and in what order.

### Example Skill Skeleton (for reference only — adapt to the actual skill)

```markdown
---
description: Generate 3 creative campaign concepts across different angles and personas. Trigger when user asks for concepts, campaign ideas, angle exploration, or says "give me some concepts for X" even if they don't say /concept-planner.
---
# Concept Planner

Load these context files first: brand-voice.md, personas.md, shopify/products.md.

## Process
1. [Step 1 — clear, imperative]
2. [Step 2]
3. [Step 3]

## Output Format
[Exact template or description of what to produce]
```

---

## Stage 3: Create Test Cases

Come up with 2-3 realistic test prompts — the kind of thing the actual user would actually type.

Share them: "Here are some test prompts I'd like to try. Do these look right?"

Save to `evals/<skill-name>/evals.json`:

```json
{
  "skill_name": "hook-writer",
  "evals": [
    {
      "id": 0,
      "prompt": "write me some hooks for our sleep aid drops, targeting moms who are chronically exhausted",
      "expected_output": "15+ hook variations across different emotional angles",
      "files": []
    },
    {
      "id": 1,
      "prompt": "/hook-writer for the new limited edition bundle, use the reviews for voice of customer",
      "expected_output": "hooks grounded in actual customer language from reviews",
      "files": []
    }
  ]
}
```

Don't write assertions yet — do that while the runs are in progress.

---

## Stage 4: Spawn Eval Runs

**Run everything in a single turn — don't batch.** Spawn one with-skill + one baseline subagent per test case, all at once.

### With-skill run prompt:
```
Execute this task:
- Skill to use: read .claude/commands/<skill-name>.md and follow its instructions exactly
- Task: <eval prompt>
- Context directory: social_media/context/
- Save all outputs to: evals/<skill-name>/iteration-<N>/eval-<ID>/with_skill/
- Save: the final markdown/HTML/text output plus a brief transcript summary
```

### Baseline run prompt (new skill):
```
Execute this task (NO special skill instructions — just use your default behavior):
- Task: <eval prompt>
- Context directory: social_media/context/
- Save outputs to: evals/<skill-name>/iteration-<N>/eval-<ID>/without_skill/
```

### Baseline run prompt (improving existing skill):
First snapshot the existing skill:
```bash
cp .claude/commands/<skill-name>.md evals/<skill-name>/skill-snapshot-iteration-<N>.md
```
Then point the baseline at the snapshot.

Create `eval_metadata.json` in each eval directory:
```json
{
  "eval_id": 0,
  "eval_name": "moms-exhausted-hooks",
  "prompt": "write me some hooks for our sleep aid drops, targeting moms who are chronically exhausted",
  "assertions": []
}
```

---

## Stage 5: Draft Assertions While Runs Are In Progress

Don't wait idle. While subagents run, draft assertions and explain them to the user.

Good assertions are objectively checkable:
- ✓ "Output contains at least 10 distinct hook variations"
- ✓ "Output includes at least one question hook and one confession hook"
- ✓ "Output references a customer review or product review quote"
- ✓ "Output is structured with labeled sections per hook type"
- ✗ "Hooks are good" — not checkable
- ✗ "Writing is engaging" — subjective

For social media skills specifically, checkable assertions often include:
- Minimum count of variations
- Presence of required sections (hook, body, CTA, hashtags)
- Character count constraints (for copy)
- Platform-specific format rules
- Required context files were consulted (check if product name or customer language appears)

Update `eval_metadata.json` and `evals/<skill-name>/evals.json` with assertions once drafted.

Capture timing data when each subagent task notification arrives:
```json
{
  "total_tokens": 84852,
  "duration_ms": 23332
}
```
Save to `evals/<skill-name>/iteration-<N>/eval-<ID>/with_skill/timing.json`.

---

## Stage 6: Grade and Show Results

Once runs complete:

### Grade each run

Spawn a grader subagent or grade inline. For each assertion, determine:
- `passed`: true/false
- `text`: the assertion text
- `evidence`: what in the output supports the pass/fail judgment

Save to `grading.json` in each run directory:
```json
{
  "eval_id": 0,
  "assertions": [
    {
      "text": "Output contains at least 10 distinct hook variations",
      "passed": true,
      "evidence": "Output contains 15 labeled hook variations across 5 categories"
    }
  ]
}
```

For assertions that can be checked programmatically (character counts, file existence, JSON structure), write a quick script rather than eyeballing it.

### Aggregate benchmark

Create `benchmark.json` in the iteration directory:
```json
{
  "skill_name": "hook-writer",
  "iteration": 1,
  "configurations": [
    {
      "name": "with_skill",
      "evals": [
        {
          "eval_id": 0,
          "eval_name": "moms-exhausted-hooks",
          "assertions_passed": 3,
          "assertions_total": 4,
          "pass_rate": 0.75,
          "tokens": 84852,
          "duration_seconds": 23.3
        }
      ],
      "summary": {
        "pass_rate_mean": 0.75,
        "pass_rate_stddev": 0.0,
        "tokens_mean": 84852,
        "duration_mean_seconds": 23.3
      }
    }
  ]
}
```

### Present results to the user

Show a clear summary:

```
## Iteration 1 Results

| Eval | With Skill | Without Skill |
|------|-----------|---------------|
| moms-exhausted-hooks | 3/4 assertions ✓ | 1/4 assertions ✓ |
| bundle-with-reviews  | 4/4 assertions ✓ | 2/4 assertions ✓ |

**Winner: with_skill on all evals**

Key observations:
- The skill's review-mining step is the big differentiator — baseline ignored reviews
- Hook count is reliably higher with skill (avg 15 vs avg 7)
- One failure: the skill didn't always include a confession hook type

Outputs saved to: evals/hook-writer/iteration-1/

What do you think? I can show you the actual output files too. Anything you want to change?
```

---

## Stage 7: Improve the Skill

This is the core loop. Read what the user says. Generalize from specific complaints into better principles.

### Improvement principles

**Generalize, don't overfit.** This skill runs thousands of times across varied prompts. Don't add rigid rules just to fix one test case — ask: what underlying principle explains the failure? Write that instead.

**Keep it lean.** Remove instructions that aren't pulling their weight. If the skill is telling Claude to do things it would do anyway, cut it. Less instruction = less noise.

**Explain the why.** Don't write `ALWAYS include a confession hook`. Write: "Confession hooks — 'I used to think...' or 'I'll be honest...' — outperform curiosity hooks for this brand's audience because they build parasocial trust before the pitch. Include at least one."

**Look for repeated work.** If all 3 test runs wrote the same helper code or followed the same 5-step approach the skill didn't specify, that behavior should be in the skill. Codify the good patterns.

**Context files are your secret weapon.** If the baseline was close but the skill should win more clearly, ask: what context file could give the skill an unfair advantage? `reviews.md` for voice-of-customer? `ad-formats.json` for format rules? Add explicit instruction to load and use it.

### After improving

1. Apply changes to `.claude/commands/<skill-name>.md`
2. Spawn iteration-2 runs (with-skill + baseline in same turn)
3. Show results, get feedback
4. Repeat until user is happy or all feedback is empty

---

## Stage 8: Optimize the Description (Triggering Accuracy)

After the skill content is solid, offer to optimize the description for better triggering.

### Generate trigger eval queries

Create 20 queries — mix of should-trigger and should-not-trigger. Focus on realistic social media agency context. Casual phrasing, typos, backstory. Make near-miss negatives genuinely tricky.

```json
[
  {
    "query": "ok so i need to write some opener lines for this ad we're running on meta for the bone broth concentrate, the target is women 35-55 who do pilates",
    "should_trigger": true
  },
  {
    "query": "what's a good strategy for our Q4 campaign budget allocation across meta and tiktok",
    "should_trigger": false
  }
]
```

**Should-trigger queries (10):** Different phrasings, formal vs. casual, explicit command vs. implicit need, uncommon edge cases.

**Should-not-trigger queries (10):** Adjacent tasks, keyword overlap without intent match, queries where another command fits better.

### Test the description

For each query, ask yourself: if Claude sees this query + the description, will it trigger? Run through the list mentally. If more than 3 feel wrong, revise the description and re-evaluate.

Key description principles:
- Name the slash command AND the natural-language phrasings
- Name the adjacent commands it should NOT take priority over
- Be explicit about edge cases ("even if the user doesn't say 'hooks' but clearly wants scroll-stopping openers")

### Apply the improved description

Update the YAML frontmatter in `.claude/commands/<skill-name>.md`. Show before/after.

---

## Done? Check These

- [ ] Description field triggers correctly (includes both command name and natural-language triggers)
- [ ] Instructions explain WHY, not just WHAT
- [ ] Context files are loaded in the right order
- [ ] Output format is clearly specified
- [ ] Tested on at least 2 realistic prompts
- [ ] Skill is lean — no redundant instructions
- [ ] File is saved to `.claude/commands/<skill-name>.md`

---

## Adding to CLAUDE.md

After creating a new skill, offer to add it to the commands table in `CLAUDE.md`. It goes under the appropriate section (Data, Research, Analytics, Creative, or Production). Format:

```markdown
| `/skill-name` | One-line description of what it does |
```
