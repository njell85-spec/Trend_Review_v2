# Trend_Review_v2 설계 제안

목표: 기존 `Trend_Review`의 좋은 부분은 유지하되, 모바일 중심 운영과 유지보수성을 우선해 처음부터 단순하게 재구현한다.

이 문서는 설계 제안이다. 승인 전에는 `Trend_Review_v2` 폴더 생성이나 코드 작성을 하지 않는다.

## 1. 설계 원칙

우선순위:

1. 단순성
2. 안정성
3. 모바일 중심 운영
4. 자동화
5. 유지보수성

비목표:

- 복잡한 multi-agent framework
- 과도한 state machine
- 별도 서버 상시 운영
- Gmail 중심 workflow
- PC가 켜져 있어야만 동작하는 구조

## 2. 권장 아키텍처

추천안은 "GitHub Actions + 정적 GitHub Pages + 모바일 알림 Bot" 구조다.

```text
GitHub Actions Scheduler
  daily 06:30 KST / manual dispatch
        |
        v
  v2 Pipeline CLI
        |
        +--> collect
        |     PubMed / Europe PMC
        |
        +--> screen
        |     deterministic relevance/design/journal rules
        |
        +--> analyze
        |     LLM structured PICO for Top-N only
        |     runtime schema validation + retry
        |
        +--> render
        |     mobile-first Markdown + HTML + JSON
        |
        +--> publish
        |     GitHub Pages static dashboard
        |
        +--> notify
              KakaoTalk provider
              Telegram fallback
              Dashboard link
```

## 3. 시스템 구성도

```text
                         Mobile
              +---------------------------+
              | KakaoTalk / Telegram      |
              | - latest summary          |
              | - dashboard link          |
              | - status / run commands   |
              +-------------^-------------+
                            |
                            |
+---------------------------+---------------------------+
| GitHub Repository                                      |
|                                                       |
| .github/workflows/daily.yml                           |
| config/topics.yml                                     |
| data/seen_pmids.json                                  |
| reports/YYYY-MM-DD.json                               |
| public/index.html                                     |
|                                                       |
| Pipeline                                              |
|  1 collect -> 2 screen -> 3 analyze -> 4 publish       |
|                                                       |
+---------------------------+---------------------------+
                            |
                            v
                    GitHub Pages
              mobile-first archive/status
```

## 4. 기술 선택

추천:

- Runtime: Node.js ESM
- DB: 초기에는 SQLite 없이 JSON/JSONL 파일
- Schema validation: `zod` 또는 `ajv`
- Template: 단순 HTML template 파일 또는 작은 renderer 함수
- Scheduler: GitHub Actions
- Dashboard: GitHub Pages
- Notification: provider interface

왜 Node.js 유지인가:

- 기존 프로젝트가 Node.js라 참고/이식 비용이 낮다.
- GitHub Actions에서 실행이 쉽다.
- PubMed/Telegram/Kakao/OpenAI/Anthropic API 호출에 충분하다.
- TypeScript까지 도입하면 비개발자 유지보수성이 떨어질 수 있으므로 MVP는 plain Node.js가 적합하다.

## 5. 폴더 구조 제안

```text
Trend_Review_v2/
  package.json
  README.md
  .env.example
  config/
    topics.yml
    delivery.yml
  src/
    cli.js
    pipeline.js
    collect.js
    screen.js
    analyze.js
    render.js
    notify/
      index.js
      kakao.js
      telegram.js
  data/
    seen_pmids.json
    runs/
      YYYY-MM-DD.json
  public/
    index.html
  reports/
    YYYY-MM-DD.md
    YYYY-MM-DD.html
    YYYY-MM-DD.json
  .github/
    workflows/
      daily.yml
```

`data/`, `reports/`, `public/`는 운영 산출물이다. 코드와 산출물을 섞지 않도록 규칙을 명확히 둔다.

## 6. Workflow

### Daily Run

1. GitHub Actions가 매일 06:30 KST 실행
2. `config/topics.yml` 로드
3. PubMed/Europe PMC에서 최근 7~30일 논문 수집
4. `seen_pmids.json`으로 중복 제거
5. deterministic pre-screen:
   - EM/CCM relevance
   - publication type
   - journal tier
   - sample size signal
   - 제외: case report, editorial, letter, animal-only, veterinary-only 등
6. 후보 10~20편으로 축소
7. LLM 분석:
   - cheap/mini model로 후보 재점수화 또는 deterministic score만 사용
   - Top 3만 상세 PICO/요약
8. schema validation:
   - 성공: 리포트 생성
   - 실패: 같은 논문 1회 재시도
   - 재실패: abstract 기반 fallback + "manual review needed" 표시
9. JSON/Markdown/HTML 저장
10. GitHub Pages 갱신
11. KakaoTalk 전송 시도
12. 실패 시 Telegram fallback
13. 최종 status 파일 저장

### Manual Run

모바일에서 가능한 실행 방법:

- Phase 1: GitHub 모바일 웹/앱에서 workflow dispatch
- Phase 2: Telegram `/run` 명령으로 GitHub workflow dispatch 호출
- Phase 2/3: KakaoTalk 명령은 공식 API 제약 확인 후 추가

## 7. Agent 구조

v2에서는 Agent 수를 줄인다.

### 권장 구조

| 구성 | 역할 | LLM 사용 |
|---|---|---|
| Collector | PubMed/Europe PMC 수집 | 없음 |
| Screener | 규칙 기반 relevance/design/journal 필터 | 없음 |
| Analyzer | Top-N PICO/요약/한국어 번역 | 있음 |
| Publisher | HTML/JSON/Markdown 저장, Pages 갱신 | 없음 |
| Notifier | Kakao/Telegram/Web link 발송 | 없음 |

LLM Agent는 사실상 `Analyzer` 하나면 충분하다. 비용을 더 줄이려면 다음 2단계로 나눌 수 있다.

- `Ranker`: 후보 10~20편을 짧게 재점수화
- `DeepAnalyzer`: Top 3만 PICO 상세 분석

하지만 MVP에서는 deterministic score + `DeepAnalyzer` 하나를 추천한다. 기존 프로젝트처럼 50편 전체를 매번 LLM 점수화하면 비용과 장애 지점이 커진다.

## 8. State / Checkpoint 전략

복잡한 state machine 대신 작은 run state 파일을 둔다.

```json
{
  "runId": "2026-06-21",
  "status": "success",
  "step": "notify",
  "startedAt": "...",
  "finishedAt": "...",
  "counts": {
    "fetched": 120,
    "screened": 18,
    "analyzed": 3,
    "sent": 1
  },
  "outputs": {
    "dashboardUrl": "...",
    "json": "reports/2026-06-21.json",
    "html": "reports/2026-06-21.html"
  },
  "errors": []
}
```

상태값:

```text
queued -> running -> success
queued -> running -> failed
```

각 step 결과는 파일로 저장한다.

- `data/runs/YYYY-MM-DD.collect.json`
- `data/runs/YYYY-MM-DD.screen.json`
- `data/runs/YYYY-MM-DD.analysis.json`
- `data/runs/YYYY-MM-DD.status.json`

장점:

- 모바일에서 status JSON 또는 dashboard로 확인 가능
- 재실행 시 어디까지 됐는지 명확함
- 클래스 기반 state machine보다 유지보수가 쉽다

## 9. 알림 방식

사용자 우선순위는 KakaoTalk > Telegram > Web Dashboard다. 이를 `NotificationProvider`로 분리한다.

```text
notify(result)
  |
  +--> KakaoProvider
  |      success -> stop
  |      fail -> log and fallback
  |
  +--> TelegramProvider
  |      success -> stop
  |      fail -> log
  |
  +--> Dashboard only
```

### KakaoTalk

현실적 판단:

- KakaoTalk Message API는 quota와 권한 제약이 있다.
- 권한 요청 전 quota가 제한되고, frequent messages 방지를 위해 quota 증가가 제한될 수 있다.
- 안정적인 운영 발송은 KakaoTalk Channel/BizMessage/알림톡 계열 검토가 필요할 수 있고, 이 경우 심사/템플릿/비용이 발생할 수 있다.

따라서 v2는 Kakao를 1순위 provider로 설계하되, MVP 안정성을 위해 Telegram fallback을 반드시 둔다.

Kakao 메시지 형태:

```text
[Trend Review] 2026-06-21
Top 3 EM/CCM 논문

1. Title...
   핵심: ...
2. Title...
   핵심: ...
3. Title...
   핵심: ...

전체 보기: GitHub Pages URL
상태: success / 3 papers analyzed
```

### Telegram

Telegram은 모바일 운영성이 좋고 구현이 단순하다.

필수 명령:

- `/latest`: 최신 리포트 요약과 링크
- `/status`: 최근 실행 상태
- `/run`: GitHub Actions workflow dispatch
- `/config`: 현재 topic/window/topN 확인

MVP에서는 push 알림만 구현하고, `/run`과 `/status`는 Phase 2로 미룰 수 있다.

### Web Dashboard

Dashboard는 알림 실패 시에도 항상 남는 최종 fallback이다.

요구사항:

- Galaxy Fold에서 보기 좋은 single-column 우선 레이아웃
- 최신 리포트가 첫 화면에 바로 보일 것
- Top 3 요약, PICO, limitation, PubMed/DOI 링크
- 실행 상태, 마지막 성공 시간, 실패 원인 표시
- 과거 리포트 archive
- 외부 CDN 의존 최소화

## 10. 모바일 운영 전략

### Phase 1 모바일 운영

- 매일 메시지로 요약 수신
- 메시지에서 dashboard link 열기
- GitHub mobile에서 manual run 가능
- 설정 변경은 `config/topics.yml` 수정

### Phase 2 모바일 운영

- Telegram `/status`, `/latest`, `/run`
- 실패 시 Telegram으로 error summary 전송
- config 변경은 issue/comment 기반 또는 Telegram command로 제한적 지원

### Phase 3 모바일 운영

- KakaoTalk command 또는 Kakao Channel 기반 상태 확인
- "관심 주제 추가", "오늘 제외", "이 논문 자세히" 같은 feedback loop
- 개인 preference 기반 ranking

## 11. 비용 전략

비용을 줄이는 핵심은 LLM 입력 논문 수를 줄이는 것이다.

권장:

- 모든 논문을 LLM에 보내지 않는다.
- deterministic pre-screen으로 후보를 10~20편으로 줄인다.
- Top 3만 상세 PICO 분석한다.
- full text는 Top 3에만 시도한다.
- 실패한 논문만 재시도한다.
- 가능하면 cached prompt / batch / mini model을 검토한다.

모델 전략:

- MVP: 저렴한 mini/sonnet급 모델로 시작
- 품질 부족 시 Top 1~3 PICO만 상위 모델 사용
- 고비용 Opus급 모델은 "최종 PICO 상세 분석"에만 제한적으로 사용

공식 가격 기준 참고:

- Anthropic Claude Opus 4.8: input $5/MTok, output $25/MTok
- Anthropic Claude Sonnet 4.6: input $3/MTok, output $15/MTok
- OpenAI GPT-5.4 mini: input $0.75/1M tokens, output $4.50/1M tokens
- OpenAI Batch API: 입력/출력 50% 절감 가능

## 12. 안정성 전략

필수:

- LLM output schema validation
- schema invalid 시 1회 repair/retry
- retry 실패 시 fallback 리포트 생성
- PubMed/API 장애 시 이전 성공 리포트 링크 재전송
- 알림 실패 시 provider fallback
- 모든 run은 `status.json`을 남김
- secrets는 GitHub Actions Secrets만 사용

권장:

- `--dry-run` fixture test
- `--date YYYY-MM-DD` 재실행
- `--no-notify` 테스트 실행
- `--max-papers`, `--top-n` 옵션
- 매일 실행 후 cost estimate 로그 기록

## 13. 기존 프로젝트에서 가져올 것

가져올 가치가 있는 아이디어:

- PubMed XML 파싱
- PMC/Unpaywall full text 시도
- Top-N full text 분석
- JSON archive + HTML dashboard
- Retry/cache/checkpoint 개념
- PICO output field 구성
- GitHub Pages archive

그대로 가져오지 않을 것:

- 현재 Agent 클래스 구조
- Gmail 중심 NotificationAgent
- 긴 HTML 문자열 template
- 하드코딩 토큰이 포함된 운영 스크립트
- MCP 설정/주석 중심 구조
- Windows Task Scheduler 중심 운영

## 14. 최종 제안

MVP는 다음으로 시작하는 것이 가장 현실적이다.

```text
GitHub Actions daily job
  -> collect PubMed/Europe PMC
  -> deterministic screen
  -> LLM PICO Top 3
  -> validate schema
  -> publish GitHub Pages
  -> notify Kakao if available, else Telegram
```

핵심은 "복잡한 agent 수"가 아니라 "항상 결과가 남고, 모바일에서 확인 가능하며, 실패해도 어디서 실패했는지 보이는 것"이다.
