# Trend_Review 현재 아키텍처 분석

분석 대상: `C:\Users\njell\Desktop\Test\Trend_Review`

주의: 기존 프로젝트는 읽기 전용 Reference Project로만 분석했다. 이 문서는 새 작업 폴더에 작성했으며, 기존 `Trend_Review` 폴더는 수정하지 않았다.

## 1. 요약

현재 `Trend_Review`는 Node.js ESM 기반의 문헌 자동 수집/분석 파이프라인이다. PubMed E-utilities에서 EM/CCM 관련 논문을 수집하고, LLM으로 임상 적용성 점수화와 PICO 분석을 수행한 뒤, HTML/JSON 리포트를 생성하고 GitHub Pages 또는 Gmail/Google Drive로 발행하는 구조다.

구현은 "멀티 에이전트" 형태로 클래스가 나뉘어 있지만, 실제로는 하나의 `TrendReviewOrchestrator`가 순차 파이프라인을 실행하는 구조다. `mcp-config.json`과 주석에는 MCP 바인딩이 등장하지만, 실제 런타임 코드는 MCP SDK가 아니라 Node `fetch`, Anthropic/OpenAI SDK, Google API SDK, 파일시스템을 직접 사용한다.

## 2. 기술 스택

- Runtime: Node.js `>=18`, ESM
- 주요 의존성: `@anthropic-ai/sdk`, `openai`, `googleapis`, `xml2js`, `dotenv`
- 논문 수집: PubMed E-utilities, 일부 자동화 스크립트는 Europe PMC 사용
- LLM: 기본 Anthropic Claude, OpenAI fallback wrapper 존재
- 산출물: JSON archive, HTML dashboard, JSONL log, checkpoint JSON
- 발행: GitHub Pages, Google Drive/Gmail
- 자동화: GitHub Actions workflow, Windows Task Scheduler용 PowerShell, 수동 실행 배치 파일

## 3. 파일 구조

핵심 구현:

- `src/index.js`: CLI entry point, 인자 파싱, dry-run, orchestrator 실행
- `src/orchestrator/TrendReviewOrchestrator.js`: 전체 파이프라인 상태/체크포인트/실행 순서 관리
- `src/agents/DataCollectorAgent.js`: PubMed 검색 및 XML 파싱
- `src/agents/ValidationAgent.js`: 1차 논문 품질 필터, 2차 PICO 품질 검사
- `src/agents/FilterAnalyzerAgent.js`: LLM 기반 점수화, Top-N 선정, PICO 분석
- `src/agents/FullTextAgent.js`: PMC/Unpaywall 기반 full text 보강
- `src/agents/ReportGeneratorAgent.js`: JSON/HTML 리포트 생성
- `src/agents/NotificationAgent.js`: Google Drive 업로드, Gmail 발송
- `src/utils/*`: Cache, CircuitBreaker, RetryHelper, Logger, LLMClient, GitHubPublisher

운영/실험 파일:

- `fetch_papers_action.yml`: GitHub Actions 기반 Europe PMC 수집/사전 선별
- `fetch_papers_task.ps1`: Windows Task Scheduler 기반 수집/푸시
- `run-today.mjs`, `send-report.mjs`, `rebuild-github.mjs`, `normalize_all.cjs`: 수동 운영/복구/발행 스크립트
- `design_*.html`, `architecture.html`, `preview_fontsize.html`: 대시보드 디자인 실험 산출물
- `output/`: cache, checkpoints, logs, reports, Google OAuth token

## 4. 현재 아키텍처

```text
CLI / Scheduler
  |
  v
TrendReviewOrchestrator
  |
  +--> DataCollectorAgent
  |      PubMed esearch/efetch -> paper[]
  |
  +--> ValidationAgent
  |      deterministic validation pass 1
  |
  +--> FilterAnalyzerAgent
  |      LLM scoring -> topN
  |
  +--> FullTextAgent
  |      PMC / Unpaywall enrichment
  |
  +--> FilterAnalyzerAgent
  |      LLM PICO analysis
  |
  +--> ValidationAgent
  |      deterministic validation pass 2
  |
  +--> ReportGeneratorAgent
  |      reports/*.json + reports/*.html
  |
  +--> GitHubPublisher
  |      GitHub Pages index.html update
  |
  +--> NotificationAgent
         Google Drive + Gmail, optional
```

## 5. Agent 구조

현재 Agent 수는 6개다.

| Agent | 책임 | 평가 |
|---|---|---|
| `DataCollectorAgent` | PubMed 검색, PMID 수집, XML 파싱 | 책임이 명확하고 유지 가치가 높다. |
| `ValidationAgent` | 필수 필드/EM-CCM 관련성/PICO 품질 검사 | LLM 비용 절감에 유용하나 규칙이 단순하고 일부 검증은 사후 보고만 한다. |
| `FilterAnalyzerAgent` | LLM 점수화, Top-N 선정, PICO 생성 | 가장 중요하지만 가장 복잡하고 비용/장애 지점이 크다. |
| `FullTextAgent` | PMC/Unpaywall full text 보강 | Top-N에만 적용하는 설계는 좋다. HTML stripping은 취약하다. |
| `ReportGeneratorAgent` | HTML/JSON 생성 | 모바일 대시보드 기반은 좋지만 HTML 문자열이 길고 유지보수 어렵다. |
| `NotificationAgent` | Drive/Gmail 발송 | Gmail 중심이라 사용자 우선순위와 맞지 않는다. Kakao는 실제 구현 없음. |

실질적으로 "agent"라는 이름은 역할 분리용 클래스에 가깝다. 독립 실행/협상/계획을 하는 에이전트 시스템은 아니다. v2에서는 Agent 수를 줄이고, LLM 호출 단계만 명확히 "분석기"로 두는 편이 더 단순하다.

## 6. Workflow 구조

`TrendReviewOrchestrator.run()`의 현재 순서:

1. `COLLECTING`: PubMed에서 최근 N일 논문 수집
2. `VALIDATING_1`: 제목/초록/관련성 기반 필터
3. `ANALYZING`: LLM으로 전체 논문 점수화, Top-N 선정
4. `FETCHING_FULLTEXT`: Top-N만 full text 보강
5. `PICO_ANALYSIS`: LLM으로 PICO/요약/한국어 번역 생성
6. `VALIDATING_2`: PICO 필드 completeness 검사
7. `REPORTING`: JSON/HTML 생성
8. `PUBLISHING`: GitHub Pages 갱신
9. `NOTIFYING`: Google Drive/Gmail 알림, 옵션

최근 실행 로그 기준 예시:

- 수집: 50편, 약 6.4초
- LLM 점수화: 약 81.6초
- full text 보강: 약 0.8초
- PICO 분석: 약 54.9초
- 전체: 약 143.7초

LLM 단계가 실행 시간과 비용의 대부분을 차지한다.

## 7. State Machine 구조

`STAGES` 상수로 상태를 정의한다.

```text
IDLE
COLLECTING
VALIDATING_1
ANALYZING
FETCHING_FULLTEXT
PICO_ANALYSIS
VALIDATING_2
REPORTING
PUBLISHING
DONE
FAILED
```

특징:

- 단계 시작/종료를 `executionLog`에 기록한다.
- 주요 단계 후 `output/checkpoints/{sessionId}.json`을 저장한다.
- `--resume {sessionId}`로 이전 checkpoint를 읽어 재개한다.
- 일부 단계 실패는 non-fatal로 처리한다. 예: 1차 validation 실패, full text 실패, notification 실패.

문제점:

- 상태 머신이라기보다 순차 메서드 호출에 상태 문자열을 얹은 구조다.
- checkpoint data shape가 단계별로 다르고 재개 조건이 필드 존재 여부에 의존한다.
- 최근 JSON 리포트의 `executionStats.stages`에는 `REPORTING/PUBLISHING/NOTIFYING` 완료 정보가 완전하게 반영되지 않았다. payload를 report stage 전에 만드는 구조 때문이다.
- 실패 후 재개는 가능하지만, 사용자가 모바일에서 현재 실패 원인과 재개 버튼을 확인하기 어렵다.

## 8. 잘 설계된 부분

- PubMed 수집, 검증, LLM 분석, 리포트 생성이 모듈별로 나뉘어 있어 흐름을 따라가기 쉽다.
- 논문 전체를 full text 분석하지 않고 Top-N에만 full text를 붙이는 방식은 비용과 지연을 잘 줄인다.
- `Cache`, `RetryHelper`, `CircuitBreaker`가 있어 외부 API 장애에 대한 기본 방어가 있다.
- LLM 출력에 tool-use schema를 사용해 구조화된 결과를 얻으려 한 방향은 좋다.
- JSONL 로그와 checkpoint가 남아 실패 분석과 재실행에 유리하다.
- GitHub Pages를 사용한 정적 대시보드는 서버 운영 부담이 작고 모바일 공유에 유리하다.
- HTML 리포트와 JSON archive를 동시에 남기는 점은 재처리/검증에 좋다.

## 9. 단점과 복잡도

### 9.1 구조적 복잡도

- 핵심 코드가 `FilterAnalyzerAgent`, `TrendReviewOrchestrator`, `ReportGeneratorAgent`, `NotificationAgent`, `GitHubPublisher`에 길게 몰려 있다.
- HTML이 긴 문자열 template로 직접 생성되어 디자인 변경이나 모바일 레이아웃 수정이 어렵다.
- 운영 스크립트가 많다. `run-today`, `send-report`, `rebuild-github`, `normalize_all`, `regen_*`, `design_*`가 함께 있어 어떤 경로가 정식 운영인지 불명확하다.
- GitHub Actions, Windows Task Scheduler, 수동 배치 실행이 병존한다.
- `mcp-config.json`은 있지만 실제 런타임과 연결되지 않아 개념적 노이즈가 된다.

### 9.2 LLM 출력 안정성

최근 산출물에서 PICO 결과 일부가 schema대로 객체가 아니라 문자열로 저장된 사례가 확인됐다.

- 3개 Top paper 중 2개에서 `pico` 타입이 `object`가 아니라 `string`
- `picoQuality`가 각각 2점으로 낮게 평가됨
- `picoIssues`: Population/Intervention/Comparison/Outcome incomplete

원인 가능성:

- tool-use 결과를 받은 뒤 런타임 schema validation이 없다.
- LLM이 schema 일부를 벗어난 경우 재시도/수정 단계 없이 리포트에 반영된다.
- validation이 문제를 감지하지만, 실패로 막거나 재분석하지 않는다.

v2에서는 `zod`/`ajv` 같은 런타임 검증과 "1회 자동 재시도 + 실패 시 보수적 fallback"이 필수다.

### 9.3 선별 품질

- 기본 PubMed query가 `"emergency medicine"[MeSH] OR "critical care"[MeSH] OR "sepsis"[MeSH]`로 넓다.
- 최근 실행의 전체 논문 목록에는 EM/CCM 직접 관련성이 낮은 논문도 포함된다.
- GitHub Actions의 Europe PMC 사전 필터는 journal tier/design/relevance를 별도로 구현하고 있어, 로컬 Node 파이프라인과 기준이 이원화되어 있다.

v2에서는 하나의 선별 기준을 `config/*.yaml`로 명확히 관리해야 한다.

### 9.4 모바일 운영성

현재 모바일 중심 운영에는 불리하다.

- 실행/재개가 CLI 중심이다.
- 실패 원인 확인은 로컬 로그 또는 GitHub Actions 로그 확인이 필요하다.
- Gmail/Drive는 구현되어 있지만 사용자의 전달 우선순위인 KakaoTalk/Telegram이 핵심 경로가 아니다.
- KakaoTalk은 코드 주석상 PlayMCP/Claude 외부 처리로 남아 있고, 실제 `NotificationAgent`에는 없다.
- Dashboard는 존재하지만 "상태 확인/재실행/설정 변경"까지 담당하지 않는다.

### 9.5 보안/운영 리스크

민감정보 자체는 문서에 기록하지 않는다. 다만 다음 위험이 확인됐다.

- `.env`, `credentials.json`, `output/google_token.json`이 로컬에 존재한다.
- GitHub PAT 형식 토큰이 일부 스크립트에 하드코딩된 흔적이 있다. 대상: `fetch_papers_task.ps1`, `normalize_all.cjs`, 번들 문서.
- `output` 폴더에 OAuth token이 저장된다.
- GitHub Pages 발행 시 공개 웹에 노출되는 데이터 범위를 명확히 통제해야 한다.

조치 권장:

- 기존 하드코딩 토큰은 즉시 revoke/rotate.
- v2에서는 모든 secret을 GitHub Actions Secrets 또는 환경변수로만 사용.
- 로컬 토큰 파일은 `.gitignore`와 별도 보관 정책 적용.
- 공개 dashboard에는 환자정보가 없더라도 API token, OAuth token, raw credential이 절대 포함되지 않도록 build 검증 추가.

## 10. 비용 평가

### 10.1 현재 비용 발생 지점

1. LLM API
   - 전체 논문 점수화와 Top-N PICO 분석이 주 비용이다.
   - 현재 코드상 기본 분석 모델은 Anthropic 계열이며, OpenAI fallback wrapper도 존재한다.

2. 자동화
   - GitHub Actions를 쓰면 public repository 기준 부담이 작다.
   - Windows Task Scheduler는 무료지만 PC가 켜져 있어야 하고 모바일 운영성이 낮다.

3. 발행/대시보드
   - GitHub Pages는 정적 대시보드에 적합하다.
   - GitHub Pages 공식 문서 기준 public repo의 GitHub Free에서 사용 가능하고, 사이트/대역폭 soft limit이 존재한다.

4. 알림
   - Gmail/Drive는 API 과금보다 OAuth 설정/권한 유지 부담이 크다.
   - Telegram Bot API는 HTTP 기반으로 구현이 단순하다.
   - KakaoTalk Message API는 quota/권한 제약이 있고, 안정적인 서버 발송에는 별도 검토가 필요하다.

### 10.2 공식 문서 기준 참고

- NCBI E-utilities: API key 없이 3 req/sec 초과 시 제한, API key 포함 시 기본 10 req/sec까지 가능.
  - Source: https://www.ncbi.nlm.nih.gov/books/NBK25497/
- GitHub Pages: public repositories with GitHub Free에서 사용 가능. Pages site는 static hosting이며, published site 1 GB, soft bandwidth 100 GB/month 등의 제한이 있다.
  - Source: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
  - Source: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Anthropic pricing: Claude Opus 4.8은 input $5/MTok, output $25/MTok. Claude Sonnet 4.6은 input $3/MTok, output $15/MTok.
  - Source: https://platform.claude.com/docs/en/about-claude/pricing
- OpenAI pricing: GPT-5.4 mini는 input $0.75/1M tokens, output $4.50/1M tokens. Batch API는 입력/출력 50% 절감 옵션이 있다.
  - Source: https://openai.com/api/pricing/
- Telegram Bot API: HTTPS 기반 Bot API이며 bot token으로 `sendMessage` 등 메서드를 호출하는 구조다.
  - Source: https://core.telegram.org/bots/api
- KakaoTalk Message API: quota가 있고, 권한 요청 전 quota가 제한되며 frequent messages 방지를 위해 quota limit 증가가 제한될 수 있다.
  - Source: https://developers.kakao.com/docs/latest/en/kakaotalk-message/common

### 10.3 대략적 비용 감각

정확한 비용은 실제 token 사용량에 따라 달라진다. 현재처럼 매일 50편을 점수화하고 Top 3를 상세 PICO 분석한다면 LLM 비용이 대부분이다.

보수적 추정:

- Claude Opus 4.8: 하루 수십 센트에서 1달러 안팎까지 갈 수 있다.
- Claude Sonnet 4.6: Opus보다 저렴하나 출력이 길면 누적 비용이 커진다.
- GPT-5.4 mini 또는 동급 mini 모델: 같은 작업을 훨씬 낮은 비용으로 수행 가능하나 의학적 요약 품질 검증이 필요하다.
- GitHub Actions/Pages: public repo + 소규모 daily job이면 사실상 무료 범위 가능성이 높다.
- Telegram: API 자체보다 hosting/automation 비용이 문제인데, GitHub Actions에서 발송하면 추가 서버 비용이 없다.
- KakaoTalk: 개인용/개발자 Message API와 운영용 BizMessage/Channel의 제약이 다르므로, MVP 전 별도 PoC와 비용 확인이 필요하다.

## 11. 유지할 가치가 있는 부분

- PubMed/PMC/Unpaywall 수집 로직의 큰 방향
- Top-N에만 full text를 붙이는 비용 절감 전략
- JSON archive + HTML dashboard 이중 산출
- checkpoint/retry/cache/circuit breaker 개념
- LLM structured output을 사용하려는 방향
- GitHub Pages 정적 archive
- 최근 30일 window + 일별 실행 구조

## 12. v2에서 버리거나 단순화할 부분

- 많은 Agent 클래스 이름과 MCP 개념 노이즈
- Gmail 중심 알림
- 여러 운영 스크립트/디자인 파일이 병존하는 구조
- HTML 전체를 JS 문자열로 직접 생성하는 방식
- Windows Task Scheduler 중심 운영
- LLM 결과를 검증 없이 리포트에 반영하는 방식
- 하드코딩된 토큰/로컬 credential 의존
- Dashboard 발행과 분석 로직이 강하게 결합된 구조

## 13. 결론

현재 프로젝트는 기능적으로 많은 것을 이미 시도했고, 수집-분석-리포트-발행까지 이어지는 end-to-end 흐름은 가치가 있다. 다만 사용자의 실제 목표가 "모바일 중심, 안정적, 단순 운영"이라면 현재 구조는 과하다. v2는 기존 코드를 복제하기보다, 다음 방향이 적합하다.

- 단일 daily pipeline
- LLM agent는 1~2개로 축소
- deterministic pre-filter 강화
- schema validation 필수화
- Telegram/Kakao/Web Dashboard 알림 adapter 분리
- GitHub Actions + GitHub Pages 중심 운영
- 모바일에서 `/status`, `/latest`, `/run`을 확인할 수 있는 얇은 제어면 제공
