# V1 Reference Review

Reference project reviewed:

```text
C:\Users\njell\Desktop\Test\Trend_Review
```

This is the previous Claude Code version of the same product idea. It is useful as a reference, but v2 should not copy its structure directly.

## What V1 Did Well

- End-to-end workflow already matched the core product:
  PubMed collection -> relevance filtering -> LLM scoring -> PICO analysis -> dashboard/report -> notification.
- The project separated major roles clearly:
  collector, validator, analyzer, full-text enricher, reporter, notifier.
- It used structured LLM output for paper scoring and PICO analysis.
- It had useful resilience ideas:
  retry helper, circuit breaker, cache, checkpoints, run logs.
- It attempted full-text enrichment only after Top-N selection, which is the right cost-saving direction.
- The report format had good medical-review concepts:
  PICO, baseline, secondary outcomes, stat glossary, practice-change bullets, evidence level, limitations.
- GitHub Actions and GitHub Pages were already a good fit for daily automation and static dashboard publishing.

## What V2 Should Avoid Copying

- Do not copy the multi-agent class structure as-is. The V1 "agents" were mostly role classes, not true independent agents.
- Do not reintroduce many operation paths at once:
  GitHub Actions, Windows Task Scheduler, local batch files, manual rebuild scripts, and one-off design files made V1 harder to reason about.
- Do not center notification around Gmail/Google Drive for MVP. KakaoTalk/Telegram/dashboard are closer to the actual user workflow.
- Do not embed a large dashboard as one long JavaScript template if avoidable. Keep rendering simpler and easier to edit.
- Do not rely on LLM output without runtime schema validation.
- Do not bring over local credentials, Google OAuth tokens, hardcoded PAT-style scripts, or generated historical output wholesale.
- Do not add MCP/plugin/subagent framing before the basic daily pipeline is stable.

## V2 Current Direction

The current v2 direction is better for a personal MVP:

```text
GitHub Actions daily run
  -> collect PubMed
  -> deterministic screening
  -> keep 30 candidates
  -> analyze/select Top 3
  -> validate schema
  -> render JSON/Markdown/HTML/dashboard
  -> notify Kakao/Telegram
```

Keep the v2 codebase as plain Node.js modules for now:

```text
src/pipeline.js       daily flow controller
src/collect.js        PubMed / fixture collection
src/screen.js         deterministic candidate scoring
src/analyze.js        LLM analysis and schema validation
src/render.js         reports and dashboard
src/notify/           Kakao / Telegram providers
```

## Best Improvements To Bring From V1

### 1. LLM Ranker Between Screening And Deep Analysis

Current v2 already keeps 30 screened candidates and analyzes Top 3. The next quality step should be:

```text
deterministic screen -> 30 candidates
LLM ranker -> select Top 3 with reasons
LLM deep analyzer -> PICO/limitations/takeaway for Top 3
```

This gives most of the benefit of "subagent discussion" without making the system heavy.

### 2. Better Analysis Schema

V1 had useful fields that v2 can add gradually:

- baseline comparability
- secondary outcomes
- stat glossary in Korean
- practice-change bullets
- full-text source marker
- PICO quality flags

Add these only after the basic daily run is stable.

### 3. PICO Quality Check

Bring over the idea, not necessarily the exact code:

```text
After LLM analysis:
  - P/I/C/O fields are non-empty and long enough
  - key findings exist
  - limitations exist
  - evidence level exists
  - score is within 0-10
```

If quality is poor, mark `manualReviewNeeded: true` or retry once.

### 4. Full-Text Enrichment Later

Do not add full-text downloading before MVP delivery works.

Good later shape:

```text
Top 3 only
  -> try PMC XML
  -> try Unpaywall open access
  -> otherwise abstract-only
  -> show source in report
```

This can later feed Google Drive, NotebookLM, or Obsidian.

### 5. Run Logs And Status

V2 already writes `data/runs/YYYY-MM-DD.*.json`. Keep this simple. Add richer status only when debugging daily failures becomes painful.

## Recommended Build Order

1. Finish account/setup path:
   GitHub repo, GitHub Pages, Actions, Telegram/Kakao tokens, OpenAI/PubMed env.
2. Confirm local and Actions dry run.
3. Confirm real live PubMed run with `--no-notify`.
4. Confirm Telegram/Kakao notification.
5. Add `AGENTS.md` to lock project operating rules.
6. Add LLM ranker for 30 candidates -> Top 3.
7. Improve PICO schema and report layout.
8. Add full-text enrichment for Top 3 only.
9. Consider Lovable UI, Google Drive/NotebookLM, and Obsidian archive.

## Final Judgment

V1 proves the product idea is viable. V2 should keep the product flow and medical-review ideas, but stay simpler:

```text
one daily pipeline
one deterministic screener
one optional LLM ranker
one deep analyzer
one static dashboard
two notification providers
```

That is enough for a strong personal-use MVP without turning the project into a heavy agent framework.
