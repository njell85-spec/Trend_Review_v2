# Trend Review v2

Mobile-first daily literature review pipeline for emergency medicine and critical care.

## Phase 1 MVP

This project implements:

- PubMed collection for recent EM/CCM papers
- deterministic pre-screening before any LLM call
- Claude Code or Gemini re-ranking from 30 screened candidates to a daily Top 1
- detailed PICO/outcome/statistics analysis with runtime schema validation
- public-source enrichment from PMC, ClinicalTrials.gov, Crossref, DOI landing metadata, and PubMed affiliations
- optional Gemini Google Search grounding for selected-paper analysis when explicitly enabled
- fallback summaries when LLM output is missing or invalid
- JSON, Markdown, HTML reports
- mobile-first static dashboard in `public/index.html`
- Telegram push notifications
- KakaoTalk "send to me" REST API push notifications
- GitHub Actions daily run and GitHub Pages deployment

## Local Setup

```bash
npm install
cp .env.example .env
```

Set only the secrets you need in `.env`. Do not commit `.env`.

For a safe local smoke test:

```bash
npm run run:dry
```

This uses `fixtures/papers.json`, skips PubMed/LLM calls, and writes:

- `reports/YYYY-MM-DD.json`
- `reports/YYYY-MM-DD.md`
- `reports/YYYY-MM-DD.html`
- `public/index.html`
- `data/runs/YYYY-MM-DD.status.json`

## Live Run

```bash
node src/cli.js --no-notify
```

Useful options:

```bash
node src/cli.js --days 180 --max-papers 300 --candidate-limit 30 --top-n 1
node src/cli.js --skip-llm --no-notify
node src/cli.js --date 2026-06-21 --ignore-seen
```

## Claude Code Subscription Mode

For higher-quality ranking and analysis without using the Anthropic API key billing path, use Claude Code authentication:

```bash
LLM_PROVIDER=claude-code
CLAUDE_CODE_MODEL=opus
```

For local runs, install Claude Code and log in once with your Claude Pro/Max/Team/Enterprise account:

```bash
claude
```

For GitHub Actions, generate a CI token locally and save it as the repository secret `CLAUDE_CODE_OAUTH_TOKEN`:

```bash
claude setup-token
```

Set the repository secret `LLM_PROVIDER` to `claude-code`, and optionally set `CLAUDE_CODE_MODEL` to `opus`.

When `LLM_PROVIDER=claude-code`, the pipeline removes `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` from the Claude Code child process so the subscription OAuth session is used instead of direct API-key billing.

## Notification Test

After setting notification secrets in `.env`, send test notifications:

```bash
npm run notify:test
npm run notify:test:telegram
npm run notify:test:kakao
```

The daily workflow uses the same senders. To test both channels for a few days, set `notifications.mode` to `all-enabled` and enable both providers in `config/delivery.yml`.

```yaml
notifications:
  mode: all-enabled
  kakao:
    enabled: true
  telegram:
    enabled: true
```

After choosing one channel, set the other provider's `enabled` value to `false`.

## Automation

GitHub Actions runs the daily workflow without the desktop PC after the repository is pushed and the required GitHub Secrets are configured.

Daily schedule:

```yaml
# 06:17 Asia/Seoul primary
- cron: '17 21 * * *'
# 07:47 Asia/Seoul catch-up
- cron: '47 22 * * *'
```

Every daily run does this:

- install dependencies
- run `npm test`
- generate the literature report if today's report does not already exist
- commit generated report files
- deploy `public/` to GitHub Pages
- send notifications through enabled providers once per KST run date
- commit `data/notifications/YYYY-MM-DD.json` as the daily notification marker

If `npm test` fails, the report and notifications do not run. Notifications are sent after GitHub Pages deployment so the message link points to the updated dashboard.

## Selection Protocol

The default protocol is optimized for a digest that can actually be read every morning:

- search the recent PubMed window, default 180 days
- collect up to 300 recent PubMed records
- pre-screen with deterministic journal, study design, and EM/CCM relevance rules
- keep about 30 screened candidates
- ask Gemini to re-rank those 30 candidates
- analyze and publish Top 1 by default
- fetch PMC open full text for the selected paper when a PMCID is available
- if PMC full text is unavailable, enrich from public registry/metadata sources such as ClinicalTrials.gov, Crossref, DOI landing metadata, and PubMed affiliations
- write only the published Top papers to `data/seen_pmids.json`

Recommended operating modes:

```bash
# Daily Top 1
node src/cli.js --days 180 --max-papers 300 --candidate-limit 30 --top-n 1

# Daily Top 1 with Gemini Google Search grounding enabled for the selected paper
node src/cli.js --days 180 --max-papers 300 --candidate-limit 30 --top-n 1 --gemini-search-grounding

# Slightly higher-volume daily digest
node src/cli.js --days 180 --max-papers 300 --candidate-limit 30 --top-n 2

# One-time catch-up/backfill, useful when starting the system
node src/cli.js --days 365 --max-papers 500 --candidate-limit 30 --top-n 3
```

For long-term daily use, `--top-n 1` is the default to avoid unread backlog. A weekly digest can later collect the best 3-5 papers without forcing marginal daily picks.

`--gemini-search-grounding` can improve depth when abstracts and public metadata are still thin, but it uses Gemini API Google Search grounding quota and may require billing depending on the project/model limits. Keep it off for the free/default workflow and enable it only when testing a higher-depth report.

## Report Format

Each selected paper is rendered as a collapsed card. Opening the card shows:

- English source-style summary with Korean interpretation underneath
- Why it matters
- study design, setting, and explicit sample size / denominator details when available
- detailed PICO
- primary and secondary outcomes inside the PICO `O` section
- compact `ⓘ` statistical interpretation plus basic reading rules for p value, OR/RR/HR, CI/CrI, risk difference, mean difference, NNT, or noninferiority margins when reported
- conclusion
- limitations
- ED/ICU applicability
- PubMed, DOI, and PMC links when available

## GitHub Secrets

Recommended repository secrets:

- `PUBMED_EMAIL`
- `PUBMED_API_KEY`
- `LLM_PROVIDER`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `CLAUDE_CODE_OAUTH_TOKEN`
- `CLAUDE_CODE_MODEL`
- `CLAUDE_CODE_TIMEOUT_MS`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `KAKAO_REST_API_KEY`
- `KAKAO_CLIENT_SECRET`
- `KAKAO_REFRESH_TOKEN`

Recommended repository variable:

- `DASHBOARD_URL`

## Notes

The generated analysis is a reading aid, not a clinical decision system. The original paper should be reviewed before changing practice.
