export function buildSmokeReport() {
  const today = new Date().toISOString().slice(0, 10);

  return {
    runId: today,
    searchWindow: { days: 30 },
    counts: { fetched: 40, analyzed: 1 },
    dashboardUrl: process.env.DASHBOARD_URL || 'https://example.github.io/Trend_Review_v2/',
    topPapers: [
      {
        pmid: '00000000',
        shortTitle_ko: '알림 전송 테스트',
        oneLineTitle_ko: 'Trend Review v2 알림 테스트',
        title: 'Trend Review v2 notification smoke test',
      },
    ],
  };
}
