# Notification Options

## Recommendation

Phase 1 can run Telegram and KakaoTalk side by side for a short real-world trial.

This is the best fit when the final choice is unclear:

- set `notifications.mode` to `all-enabled`
- set both provider `enabled` values to `true`
- receive both messages for a few days
- disable the less useful provider

Telegram remains the simplest reliable path for daily automatic delivery:

- GitHub Actions can call it directly.
- No OAuth flow is needed.
- Only `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are required.
- The v2 code already implements `sendMessage`.

KakaoTalk is more useful if it is the channel the user actually checks every day. The v2 code now supports KakaoTalk through the Kakao REST API, while the nachatbot MCP path remains a separate option.

## Telegram

Status: implemented.

Implementation:

- Sender: `src/notify/telegram.js`
- Smoke test: `npm run notify:test`
- Daily run after GitHub Pages deploy: `.github/workflows/daily.yml`

Required secrets:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Official reference:

- https://core.telegram.org/bots/api#sendmessage

## KakaoTalk Through Kakao REST API

Status: implemented as a configurable provider.

Kakao Developers provides a Kakao Talk Message REST API. For this personal workflow, the relevant target is "Send to me", which sends a message to the logged-in user's KakaoTalk My Chatroom.

Important constraints:

- Requires a Kakao Developers app.
- Requires Kakao Login / OAuth access token handling.
- Requires the `talk_message` consent scope.
- Requires the dashboard web domain to be registered in Kakao Developers Product Link settings.
- Sending to friends or other users has additional permission and quota constraints.
- KakaoTalk Share is different from KakaoTalk Message and is not the right server-side automation path.

Required secrets:

- `KAKAO_REST_API_KEY`
- `KAKAO_REFRESH_TOKEN`
- `KAKAO_CLIENT_SECRET` if enabled for the Kakao app

Smoke test:

```bash
npm run notify:test:kakao
```

Official reference:

- https://developers.kakao.com/docs/en/kakaotalk-message/rest-api

## KakaoTalk Through Nachatbot MCP

Status: possible only if the MCP runtime is reachable from the scheduler.

This appears to be how the reference project currently sends KakaoTalk messages. It can work well on a local PC where the MCP is installed, but GitHub-hosted Actions cannot call a local MCP running only on the user's desktop.

Operational choices:

- Local PC scheduler + local MCP: possible, but the PC must be awake and configured.
- GitHub Actions + remote MCP/API endpoint: possible only if the MCP is exposed safely as a reachable service.
- GitHub Actions + Kakao REST API: possible, but requires Kakao OAuth setup.

## Current v2 Decision

Use both providers during the trial period, then turn one off in `config/delivery.yml`.

For example, Kakao only:

```yaml
notifications:
  mode: all-enabled
  kakao:
    enabled: true
  telegram:
    enabled: false
```

For Telegram only:

```yaml
notifications:
  mode: all-enabled
  kakao:
    enabled: false
  telegram:
    enabled: true
```
