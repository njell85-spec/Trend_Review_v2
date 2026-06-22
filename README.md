# Trend Review v2

Mobile-first daily literature review pipeline for emergency medicine and critical care.

## Phase 1 MVP

This project implements:

- PubMed collection for recent EM/CCM papers
- deterministic pre-screening before any LLM call
- Top 3 PICO-style analysis with runtime schema validation
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
node src/cli.js --days 14 --max-papers 50 --candidate-limit 30 --top-n 3
node src/cli.js --skip-llm --no-notify
node src/cli.js --date 2026-06-21 --ignore-seen
```

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
# 06:30 Asia/Seoul
- cron: '30 21 * * *'
```

Every daily run does this:

- install dependencies
- run `npm test`
- generate the literature report
- commit generated report files
- deploy `public/` to GitHub Pages
- send notifications through enabled providers

If `npm test` fails, the report and notifications do not run. Notifications are sent after GitHub Pages deployment so the message link points to the updated dashboard.

## Selection Protocol

The default protocol is close to the reference project:

- search the recent PubMed window, default 30 days
- pre-screen 30-50 papers with deterministic journal, study design, and EM/CCM relevance rules
- keep about 30 screened candidates
- analyze and publish Top 3
- write only the published Top papers to `data/seen_pmids.json`

Recommended operating modes:

```bash
# Daily Top 3
node src/cli.js --top-n 3 --max-papers 50 --candidate-limit 30

# Higher-quality and less forced
node src/cli.js --top-n 1 --max-papers 50 --candidate-limit 30

# One-time catch-up/backfill, useful when starting the system
node src/cli.js --days 180 --max-papers 200 --candidate-limit 30 --top-n 3
```

For long-term daily use, `--top-n 1` is usually more stable. A weekly digest can then collect the best 3-5 papers without forcing marginal daily picks.

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
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `KAKAO_REST_API_KEY`
- `KAKAO_CLIENT_SECRET`
- `KAKAO_REFRESH_TOKEN`

Recommended repository variable:

- `DASHBOARD_URL`

## Notes

The generated analysis is a reading aid, not a clinical decision system. The original paper should be reviewed before changing practice.
