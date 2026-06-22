import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKakaoTemplateObject } from '../src/notify/kakao.js';

test('kakao text template stays within default template limits', () => {
  const template = buildKakaoTemplateObject({
    runId: '2026-06-21',
    searchWindow: { days: 30 },
    counts: { fetched: 40, analyzed: 3 },
    dashboardUrl: 'https://njell85-spec.github.io/Trend_Review_v2/',
    topPapers: [
      {
        pmid: '1',
        title: 'A very long emergency medicine and critical care paper title that should be truncated for KakaoTalk',
      },
      {
        pmid: '2',
        title: 'Second selected article',
      },
      {
        pmid: '3',
        title: 'Third selected article',
      },
    ],
  });

  assert.equal(template.object_type, 'text');
  assert.ok(template.text.length <= 200);
  assert.equal(template.link.mobile_web_url, 'https://njell85-spec.github.io/Trend_Review_v2/');
  assert.equal(template.button_title, '리포트 보기');
});
