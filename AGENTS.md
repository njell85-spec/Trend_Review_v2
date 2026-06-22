# Trend Review v2 Working Rules

## Communication

- Respond to the user in Korean using polite speech.
- The user prefers natural-language, vibe-coding style direction. Do the code, config, test, and setup work directly when the intent is clear.
- Keep explanations practical. Summarize what changed, what passed, and what the next step is.

## Project Goal

Trend Review v2 is a personal daily EM/CCM literature review pipeline.

Core flow:

```text
PubMed collection
-> deterministic screening
-> keep 30 candidates
-> select/analyze Top 3
-> PICO, limitations, and clinical takeaway report
-> GitHub Pages dashboard
-> KakaoTalk / Telegram notification
```

## Architecture Direction

- Keep the MVP light and reliable.
- Prefer plain Node.js modules over a heavy multi-agent framework.
- Do not add subagents, plugins, MCP servers, hooks, or large frameworks unless there is a clear, near-term need.
- Use deterministic screening before LLM calls to control cost and make selection explainable.
- Add an LLM ranker later only after the basic daily pipeline, dashboard, and notifications are stable.

## Code Boundaries

- `src/pipeline.js` controls the daily run.
- `src/collect.js` handles PubMed or fixture collection.
- `src/screen.js` handles deterministic filtering and candidate scoring.
- `src/analyze.js` handles LLM analysis and schema validation.
- `src/render.js` handles report and dashboard output.
- `src/notify/` handles KakaoTalk and Telegram delivery.

## Safety

- Never commit `.env`, API keys, OAuth tokens, or local credentials.
- Do not print secrets back to the user after they provide them.
- Keep `.codex-remote-attachments/` out of Git.
- Before committing, check `git status --short`.

## Verification

- After JavaScript changes, run `npm.cmd test`.
- For a local pipeline smoke test, run `npm.cmd run run:dry`.
- Use `npm.cmd` on Windows because PowerShell may block `npm.ps1`.

## Near-Term Build Order

1. GitHub repo, GitHub Pages, and GitHub Actions.
2. Telegram and KakaoTalk notification setup.
3. OpenAI/PubMed live run setup.
4. LLM ranker for 30 candidates -> Top 3.
5. PICO/report quality improvements.
6. Later: full-text enrichment, Google Drive/NotebookLM, Obsidian archive, Lovable UI.
