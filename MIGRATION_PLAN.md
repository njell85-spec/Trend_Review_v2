# Trend_Review → Trend_Review_v2 구현 계획

이 문서는 구현 계획이다. 사용자 승인 전에는 `Trend_Review_v2` 폴더 생성, 코드 작성, workflow 작성, 새 프로젝트 초기화를 하지 않는다.

## 전체 전략

기존 프로젝트를 복제하지 않는다. 다음 순서로 재구현한다.

1. 기존 프로젝트에서 개념만 가져온다.
2. v2는 단순한 daily pipeline으로 시작한다.
3. 모바일 운영성과 알림 안정성을 먼저 확보한다.
4. KakaoTalk은 1순위 목표로 두되, 공식 API 제약 때문에 Telegram fallback을 반드시 둔다.
5. 모든 LLM 출력은 schema validation을 통과해야만 리포트에 반영한다.

## Phase 1: MVP

목표: 매일 자동으로 최신 EM/CCM 논문 Top 3 요약을 만들고, 모바일에서 확인 가능한 링크와 알림을 받는다.

### 범위

- 새 `Trend_Review_v2` 프로젝트 생성
- GitHub Actions daily workflow
- PubMed 또는 Europe PMC 수집
- deterministic pre-screen
- Top 3 PICO 분석
- JSON/Markdown/HTML 리포트 생성
- GitHub Pages dashboard
- Telegram push 알림
- KakaoTalk provider 인터페이스만 설계, 실제 발송은 PoC 가능성 확인 후 연결
- `status.json` 저장
- secrets는 `.env.example`과 GitHub Actions Secrets 기준으로만 설계

### 구현 항목

1. 프로젝트 골격
   - `src/cli.js`
   - `src/pipeline.js`
   - `src/collect.js`
   - `src/screen.js`
   - `src/analyze.js`
   - `src/render.js`
   - `src/notify/telegram.js`
   - `config/topics.yml`

2. 수집
   - 최근 7~30일 window
   - EM/CCM query
   - publication type filter
   - duplicate PMID 제거
   - `seen_pmids.json` 관리

3. 선별
   - relevance keyword
   - journal tier
   - study design
   - sample size signal
   - 제외 규칙: case report, editorial, letter, animal-only, veterinary-only

4. 분석
   - Top 3만 LLM 상세 분석
   - PICO, 핵심 결과, limitation, clinical takeaway, 한국어 요약
   - `zod` 또는 `ajv` schema validation
   - 실패 시 1회 재시도
   - 재실패 시 fallback summary

5. 산출
   - `reports/YYYY-MM-DD.json`
   - `reports/YYYY-MM-DD.md`
   - `reports/YYYY-MM-DD.html`
   - `public/index.html`
   - `data/runs/YYYY-MM-DD.status.json`

6. 알림
   - Telegram push message
   - 메시지에는 Top 3 제목, 한 줄 핵심, dashboard link 포함
   - KakaoTalk은 provider interface만 두고, credentials/권한/쿼터 확인 후 Phase 2에서 정식화

7. 검증
   - fixture 기반 dry-run
   - schema validation 실패 fixture
   - 알림 실패 시 dashboard는 생성되는지 확인
   - GitHub Actions 수동 실행 테스트

### Phase 1 완료 기준

- PC 없이 GitHub Actions에서 하루 1회 실행된다.
- 모바일에서 Telegram 또는 dashboard로 결과를 볼 수 있다.
- 리포트가 매번 JSON/HTML로 남는다.
- LLM schema 오류가 리포트 품질 저하로 조용히 통과하지 않는다.
- secret이 코드에 직접 들어가지 않는다.

### Phase 1에서 하지 않을 것

- 복잡한 multi-agent framework
- Gmail 발송
- 별도 서버
- SQLite 도입
- 관리자 웹앱
- Kakao BizMessage/알림톡 정식 연동
- Telegram command control 전체 구현

## Phase 2: 모바일 제어와 KakaoTalk 강화

목표: 모바일에서 상태 확인, 재실행, 최신 리포트 확인이 가능하게 만든다. KakaoTalk 전달을 실제 운영 수준으로 검증한다.

### 범위

- Telegram command bot
- KakaoTalk 발송 PoC 또는 정식 provider 구현
- GitHub workflow dispatch API 연동
- 실패 알림 강화
- dashboard archive 개선
- 설정 변경 UX 개선

### 구현 항목

1. Telegram commands
   - `/latest`: 최신 리포트 링크와 요약
   - `/status`: 최근 run 상태
   - `/run`: GitHub Actions workflow dispatch
   - `/config`: 현재 검색 설정 확인

2. KakaoTalk
   - Kakao Developers Message API 가능성 확인
   - OAuth token refresh 안정성 검증
   - quota와 permission 요청 필요성 확인
   - 개인용 메시지 API가 불안정하면 Kakao Channel/BizMessage/알림톡 경로 검토
   - provider fallback 정책 확정

3. Dashboard
   - 최근 7일 archive
   - 실행 상태 표시
   - 실패 원인 표시
   - PubMed/DOI/PMCID link 정리
   - Galaxy Fold 기준 모바일 레이아웃 점검

4. 품질 피드백
   - "관심 있음/낮음" 수동 feedback 저장
   - 다음 ranking에 가중치 반영

5. 비용 관리
   - run별 예상 token/cost 기록
   - 월 비용 상한 설정 안내
   - Top-N, 후보 수 config로 조절

### Phase 2 완료 기준

- 모바일 Telegram에서 최신 결과와 상태를 확인할 수 있다.
- 모바일에서 수동 재실행이 가능하다.
- KakaoTalk 전달 가능 여부가 실사용 기준으로 결론난다.
- 실패 시 사용자가 "무엇이 실패했고 결과가 어디까지 생성됐는지" 바로 알 수 있다.

## Phase 3: 품질 고도화와 장기 운영

목표: 논문 선별 품질과 장기 유지보수성을 높인다.

### 범위

- 더 정교한 선별 기준
- 관심 주제 개인화
- 장기 archive 검색
- 비용 최적화
- 백업/복구
- 의학적 안전장치 강화

### 구현 항목

1. 선별 고도화
   - journal tier config 외부화
   - study type normalization
   - guideline/RCT/meta-analysis 우선순위 조정
   - pediatric/adult, sepsis/airway/trauma 등 topic별 weight

2. 분석 고도화
   - abstract-only와 full-text 분석을 명확히 구분
   - full text 근거 표시
   - 통계값 hallucination 방지 강화
   - "논문에 명시되지 않은 값은 계산하지 않음" 검사

3. 모바일 UX
   - "오늘 요약만 보기"
   - "자세히 보기"
   - "이 주제 더 많이"
   - "이 논문 제외"

4. 운영 안정성
   - weekly health check
   - 이전 성공 리포트 fallback
   - GitHub Pages build 실패 감지
   - token 만료 감지
   - secrets rotation checklist

5. Archive
   - 월별 index
   - topic별 filter
   - PubMed PMID 검색
   - JSON export

### Phase 3 완료 기준

- 한 달 이상 PC 없이 자동 운영 가능하다.
- 모바일에서 결과 확인/상태 확인/재실행이 자연스럽다.
- 비용 추적이 가능하다.
- 선별 품질 feedback을 반영할 수 있다.

## 마이그레이션 중 유의사항

### 기존 프로젝트에서 직접 복사하지 않을 것

- 하드코딩 토큰이 포함된 스크립트
- `output/google_token.json`
- `.env`
- `credentials.json`
- 긴 실험용 HTML 파일들
- 과거 generated reports 전체

### 참고만 할 것

- PubMed parsing 방식
- PICO field 구성
- GitHub Pages archive 아이디어
- retry/cache/checkpoint 개념
- full text를 Top-N에만 적용하는 전략

### 반드시 새로 설계할 것

- secrets 관리
- 알림 provider 구조
- schema validation
- 모바일 status
- 비용 로그
- dashboard mobile layout

## 승인 후 첫 작업 제안

승인 후에는 다음 순서로 시작하는 것이 좋다.

1. `Trend_Review_v2` 폴더 생성
2. 최소 Node.js 프로젝트 초기화
3. `config/topics.yml` 작성
4. fixture 기반 `collect -> screen -> render` dry-run
5. LLM 분석 연결
6. Telegram 알림 연결
7. GitHub Actions 연결
8. GitHub Pages 연결
9. KakaoTalk PoC 검토

## 승인 전 상태

현재 상태는 분석/설계 완료 대기다.

- `Trend_Review_v2` 폴더 미생성
- 코드 미작성
- 기존 `Trend_Review` 미수정
- 다음 단계는 사용자 승인 후 진행
