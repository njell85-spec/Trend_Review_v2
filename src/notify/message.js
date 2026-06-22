const MEDALS = ['🥇', '🥈', '🥉'];

export function buildMobileSummaryMessage(report) {
  const runDate = report.runId;
  const days = report.searchWindow?.days ?? '';
  const fetched = report.counts?.fetched ?? 0;
  const analyzed = report.counts?.analyzed ?? report.topPapers?.length ?? 0;
  const dashboardUrl = normalizeDashboardUrl(report.dashboardUrl);
  const lines = [
    '[Trend Review] 리포트 생성 완료',
    `${runDate} · 최근 ${days}일 ${fetched}편 수집 · Top ${analyzed}`,
    '',
  ];

  for (const [index, result] of report.topPapers.slice(0, 3).entries()) {
    const medal = MEDALS[index] ?? `${index + 1}.`;
    lines.push(`${medal} ${compactPaperTitle(result)} (PMID:${result.pmid})`);
  }

  if (dashboardUrl) {
    lines.push('');
    lines.push(`전체 리포트: ${dashboardUrl}`);
  }

  return lines.join('\n');
}

function compactPaperTitle(result) {
  const title = result.shortTitle_ko || result.oneLineTitle_ko || result.title || '제목 없음';
  return truncateTitle(title);
}

function truncateTitle(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= 34) return text;
  return `${text.slice(0, 33)}…`;
}

function normalizeDashboardUrl(url) {
  if (!url) return '';
  return String(url).replace(/^https?:\/\//, '').replace(/\/$/, '/');
}
