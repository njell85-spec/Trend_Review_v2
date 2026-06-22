# Tomorrow Setup Checklist

Goal: get real Telegram and KakaoTalk test messages, then enable daily GitHub Actions automation.

## 1. Local Sanity Check

```powershell
cd "C:\Users\njell\Desktop\Test\Trend_Review v2"
npm test
npm run run:dry
```

Expected:

- all tests pass
- dry run prints `Trend Review YYYY-MM-DD: success`

## 2. Push v2 To GitHub

Create a new GitHub repository, for example `Trend_Review_v2`.

```powershell
git init
git add .
git commit -m "Initial Trend Review v2 MVP"
git branch -M main
git remote add origin https://github.com/<YOUR_ID>/Trend_Review_v2.git
git push -u origin main
```

## 3. Enable GitHub Pages

Repository settings:

- `Settings`
- `Pages`
- Source: `GitHub Actions`

Expected dashboard URL:

```text
https://<YOUR_ID>.github.io/Trend_Review_v2/
```

## 4. Telegram Test

In Telegram:

- open `@BotFather`
- run `/newbot`
- copy the bot token
- send any message to the new bot
- open `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates`
- copy `chat.id`

Local `.env`:

```env
DASHBOARD_URL=https://<YOUR_ID>.github.io/Trend_Review_v2/
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

Test:

```powershell
npm run notify:test:telegram
```

## 5. KakaoTalk Test

In Kakao Developers:

- create app
- copy REST API key
- enable Kakao Login
- add redirect URI, for example `http://localhost:3000/oauth/kakao`
- enable or request the `talk_message` consent item
- register GitHub Pages web domain, for example `https://<YOUR_ID>.github.io`

Open this URL in a browser:

```text
https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=<REST_API_KEY>&redirect_uri=http://localhost:3000/oauth/kakao&scope=talk_message
```

After consent, copy the `code` value from the redirected URL.

Exchange code for tokens:

```powershell
$body = @{
  grant_type = "authorization_code"
  client_id = "<REST_API_KEY>"
  redirect_uri = "http://localhost:3000/oauth/kakao"
  code = "<CODE>"
  client_secret = "<CLIENT_SECRET_IF_ENABLED>"
}

Invoke-RestMethod -Method Post `
  -Uri "https://kauth.kakao.com/oauth/token" `
  -ContentType "application/x-www-form-urlencoded;charset=utf-8" `
  -Body $body
```

Local `.env`:

```env
KAKAO_REST_API_KEY=...
KAKAO_CLIENT_SECRET=...
KAKAO_REFRESH_TOKEN=...
```

Test:

```powershell
npm run notify:test:kakao
```

## 6. GitHub Secrets And Variable

Repository settings:

- `Settings`
- `Secrets and variables`
- `Actions`

Secrets:

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

Variable:

- `DASHBOARD_URL`

## 7. Manual GitHub Actions Test

Repository:

- `Actions`
- `Daily Trend Review`
- `Run workflow`

First safe run:

- `dry_run`: true
- `no_notify`: false

Expected:

- tests pass
- dashboard deploys
- Telegram message arrives if Telegram secrets are set
- KakaoTalk message arrives if Kakao secrets are set

## 8. Daily Automation

After setup, GitHub Actions runs daily at:

```text
06:30 Asia/Seoul
```

The desktop PC does not need to be on.

## Important Kakao Note

Kakao may issue a new refresh token during refresh. If that happens, update `KAKAO_REFRESH_TOKEN` in GitHub Secrets. Telegram is simpler for long-term unattended operation.
