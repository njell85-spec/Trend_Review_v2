import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMobileSummaryMessage } from '../src/notify/message.js';

test('mobile summary message includes status, top papers, and dashboard link', () => {
  const message = buildMobileSummaryMessage({
    runId: '2026-06-20',
    searchWindow: { days: 30 },
    counts: { fetched: 40 },
    dashboardUrl: 'https://njell85-spec.github.io/Trend_Review/',
    topPapers: [
      { pmid: '42268612', title: 'INSPIRE 암환자 항생제 RCT' },
      { pmid: '42308241', title: '날록손 OA-OHCA SR' },
      { pmid: '42216617', title: 'iLATAM 췌장염 가이드라인' },
    ],
  });

  assert.match(message, /\[Trend Review\] 리포트 생성 완료/);
  assert.match(message, /2026-06-20/);
  assert.match(message, /최근 30일 40편 수집/);
  assert.match(message, /INSPIRE 암환자 항생제 RCT \(PMID:42268612\)/);
  assert.match(message, /전체 리포트: njell85-spec.github.io\/Trend_Review\//);
});
