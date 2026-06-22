export function renderArchiveDashboard(reports) {
  const safeReports = reports.length ? reports : [emptyReport()];
  const latest = safeReports[0];
  const totals = getTotals(safeReports);
  const journalRows = safeReports
    .flatMap((report) => (report.topPapers ?? []).map((result) => ({ report, result })))
    .slice(0, 18);

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Trend Review</title>
  <style>
    :root {
      --ink: #18212f;
      --muted: #697386;
      --line: #dfe5ee;
      --page: #f6f8fb;
      --paper: #ffffff;
      --teal: #0f766e;
      --blue: #244c9a;
      --plum: #6f3f85;
      --coral: #b65346;
      --gold: #90661c;
      --soft-teal: #e7f4f1;
      --soft-blue: #ebf1ff;
      --soft-coral: #fff0ed;
      --shadow: 0 12px 32px rgba(24, 33, 47, .08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--page);
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.52;
    }
    a {
      color: var(--blue);
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
    }
    .wrap {
      width: min(100% - 28px, 1040px);
      margin: 0 auto;
    }
    .mast {
      background:
        linear-gradient(90deg, rgba(15,118,110,.16), transparent 36%),
        linear-gradient(180deg, #fff, #f9fbfd);
      border-bottom: 1px solid var(--line);
    }
    .mast-inner {
      padding: 22px 0 18px;
      display: grid;
      gap: 18px;
    }
    .topline {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 18px;
    }
    h1 {
      margin: 0;
      font-size: clamp(1.7rem, 5vw, 2.55rem);
      line-height: 1.05;
      letter-spacing: 0;
    }
    .subtitle {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: .95rem;
      max-width: 56rem;
    }
    .run-state {
      display: inline-grid;
      gap: 3px;
      justify-items: end;
      white-space: nowrap;
      color: var(--muted);
      font-size: .8rem;
      padding-top: 3px;
    }
    .run-state strong {
      color: var(--teal);
      font-size: .9rem;
      text-transform: uppercase;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 9px;
    }
    .stat {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      min-width: 0;
    }
    .stat b {
      display: block;
      font-size: 1.45rem;
      line-height: 1.1;
    }
    .stat span {
      color: var(--muted);
      display: block;
      margin-top: 4px;
      font-size: .75rem;
    }
    main {
      padding: 18px 0 34px;
      display: grid;
      gap: 14px;
    }
    .today {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .today-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      padding: 15px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(90deg, #ffffff, #f8fafc);
    }
    .today-title {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      min-width: 0;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 26px;
      padding: 3px 9px;
      border-radius: 999px;
      background: var(--soft-teal);
      color: var(--teal);
      font-size: .75rem;
      font-weight: 800;
      white-space: nowrap;
    }
    .today-date {
      font-size: 1.05rem;
      font-weight: 850;
    }
    .today-meta {
      color: var(--muted);
      font-size: .86rem;
      align-self: center;
      white-space: nowrap;
    }
    .quick-list {
      display: grid;
      gap: 9px;
      padding: 14px 15px 16px;
    }
    .quick-item {
      display: grid;
      grid-template-columns: 26px minmax(0, 1fr);
      gap: 8px;
      align-items: start;
    }
    .quick-index {
      color: var(--teal);
      font-weight: 850;
      line-height: 1.45;
    }
    .quick-title {
      font-weight: 780;
      font-size: .95rem;
    }
    .quick-meta {
      margin-top: 2px;
      color: var(--muted);
      font-size: .78rem;
    }
    .paper-stack {
      display: grid;
      gap: 12px;
    }
    details.paper {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    details.paper[open] {
      border-color: rgba(15, 118, 110, .45);
      box-shadow: var(--shadow);
    }
    summary {
      list-style: none;
      cursor: pointer;
    }
    summary::-webkit-details-marker { display: none; }
    .paper-summary {
      display: grid;
      grid-template-columns: 34px minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
      padding: 14px;
    }
    .rank {
      width: 31px;
      height: 31px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: var(--teal);
      font-size: .78rem;
      font-weight: 850;
    }
    .rank.two { background: var(--blue); }
    .rank.three { background: var(--plum); }
    .paper-title {
      margin: 0;
      font-size: clamp(1rem, 2.5vw, 1.25rem);
      line-height: 1.32;
      letter-spacing: 0;
      font-weight: 850;
    }
    .paper-meta {
      margin-top: 5px;
      color: var(--muted);
      font-size: .82rem;
    }
    .tag {
      border: 1px solid var(--line);
      background: #fff;
      border-radius: 999px;
      padding: 4px 9px;
      font-size: .76rem;
      color: var(--ink);
      white-space: nowrap;
    }
    .paper-body {
      border-top: 1px solid var(--line);
      background: #fbfcfe;
      padding: 15px;
      display: grid;
      gap: 14px;
    }
    .callout {
      padding: 12px;
      border-radius: 8px;
      background: var(--soft-blue);
      border: 1px solid #d8e3ff;
    }
    .callout strong,
    .section h3 {
      display: block;
      margin: 0 0 6px;
      color: var(--blue);
      font-size: .84rem;
      font-weight: 850;
    }
    .section {
      display: grid;
      gap: 7px;
    }
    .section p { margin: 0; }
    .ko {
      color: #536073;
      font-size: .9rem;
    }
    .pico-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .pico {
      border: 1px solid #e2e8f0;
      background: #fff;
      border-radius: 8px;
      padding: 10px;
      min-width: 0;
    }
    .pico b {
      display: block;
      color: var(--teal);
      font-size: .78rem;
      margin-bottom: 5px;
    }
    .bottom-line {
      background: var(--soft-coral);
      border: 1px solid #ffd8d0;
      border-radius: 8px;
      padding: 12px;
    }
    .bottom-line h3 { color: var(--coral); }
    ul {
      margin: 0;
      padding-left: 1.1rem;
    }
    li + li { margin-top: 5px; }
    .days {
      display: grid;
      gap: 10px;
    }
    details.day {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--paper);
      overflow: hidden;
    }
    .day-summary {
      padding: 12px 14px;
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }
    .day-date {
      font-weight: 850;
    }
    .day-list {
      padding: 0 14px 13px;
      color: var(--muted);
      font-size: .84rem;
      display: grid;
      gap: 5px;
    }
    .journal {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    .journal-head {
      padding: 12px 14px;
      border-bottom: 1px solid var(--line);
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-weight: 850;
    }
    .journal-table {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 680px;
      font-size: .8rem;
    }
    th, td {
      text-align: left;
      vertical-align: top;
      padding: 9px 10px;
      border-bottom: 1px solid #eef2f7;
    }
    th {
      color: var(--muted);
      font-size: .68rem;
      text-transform: uppercase;
      letter-spacing: 0;
    }
    footer {
      border-top: 1px solid var(--line);
      padding: 18px 0 28px;
      color: var(--muted);
      text-align: center;
      font-size: .78rem;
    }
    @media (max-width: 760px) {
      .wrap { width: min(100% - 24px, 1040px); }
      .topline,
      .today-head { grid-template-columns: 1fr; }
      .run-state { justify-items: start; white-space: normal; }
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .today-meta { white-space: normal; }
      .paper-summary {
        grid-template-columns: 34px minmax(0, 1fr);
      }
      .paper-summary .tag {
        grid-column: 2;
        justify-self: start;
      }
      .pico-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header class="mast">
    <div class="wrap mast-inner">
      <div class="topline">
        <div>
          <h1>EM/CCM Trend Review</h1>
          <p class="subtitle">Emergency Medicine & Critical Care Medicine literature briefing</p>
        </div>
        <div class="run-state">
          <strong>${escapeHtml(latest.status?.status ?? 'ready')}</strong>
          <span>${escapeHtml(formatKst(latest.generatedAt))}</span>
        </div>
      </div>
      <div class="stats">
        ${stat('Days', totals.days)}
        ${stat('Fetched', latest.counts?.fetched ?? 0)}
        ${stat('Screened', latest.counts?.screened ?? 0)}
        ${stat('Top Papers', latest.topPapers?.length ?? 0)}
      </div>
    </div>
  </header>
  <main class="wrap">
    ${renderToday(latest)}
    <section class="paper-stack">
      ${(latest.topPapers ?? []).map((result, index) => renderPaper(result, index)).join('\n')}
    </section>
    ${safeReports.length > 1 ? renderDays(safeReports.slice(1)) : ''}
    ${journalRows.length ? renderJournalArchive(journalRows) : ''}
  </main>
  <footer>
    Trend Review v2 · PubMed pipeline · schema-validated summaries
  </footer>
</body>
</html>`;
}

function renderToday(report) {
  const papers = report.topPapers ?? [];
  return `<section class="today">
  <div class="today-head">
    <div class="today-title">
      <span class="pill">Latest</span>
      <span class="today-date">${escapeHtml(report.runId)}</span>
      <span class="muted">${escapeHtml(String(papers.length))} papers</span>
    </div>
    <div class="today-meta">${escapeHtml(report.searchWindow?.days ?? '')}-day window · ${escapeHtml(formatKst(report.generatedAt))}</div>
  </div>
  <div class="quick-list">
    ${papers.slice(0, 3).map((result, index) => renderQuickItem(result, index)).join('\n')}
  </div>
</section>`;
}

function renderQuickItem(result, index) {
  const paper = result.paper ?? {};
  return `<div class="quick-item">
  <div class="quick-index">${index + 1}</div>
  <div>
    <div class="quick-title">${escapeHtml(result.title)}</div>
    <div class="quick-meta">${escapeHtml(paper.journal ?? '')} · ${escapeHtml(paper.pubDate ?? '')} · PMID ${escapeHtml(result.pmid)}</div>
  </div>
</div>`;
}

function renderPaper(result, index) {
  const paper = result.paper ?? {};
  const studyType = shortStudyType(paper.screeningData?.studyType ?? '', result.evidenceLevel);
  const rankClass = index === 1 ? ' two' : index === 2 ? ' three' : '';
  return `<details class="paper"${index === 0 ? ' open' : ''}>
  <summary class="paper-summary">
    <span class="rank${rankClass}">${String(index + 1).padStart(2, '0')}</span>
    <div>
      <h2 class="paper-title">${escapeHtml(result.title)}</h2>
      <div class="paper-meta">${escapeHtml(paper.journal ?? '')} · ${escapeHtml(paper.pubDate ?? '')}</div>
    </div>
    <span class="tag">${escapeHtml(studyType)}</span>
  </summary>
  <div class="paper-body">
    <div class="callout">
      <strong>Why It Matters</strong>
      <p>${escapeHtml(result.clinicalQuestion || result.oneLineSummary_ko || '-')}</p>
      ${result.clinicalQuestion_ko ? `<p class="ko">${escapeHtml(result.clinicalQuestion_ko)}</p>` : ''}
    </div>
    ${renderPico(result)}
    ${renderFindings(result)}
    <div class="bottom-line section">
      <h3>Clinical Bottom Line</h3>
      <p>${escapeHtml(result.clinicalTakeaway || '-')}</p>
      ${result.clinicalTakeaway_ko ? `<p class="ko">${escapeHtml(result.clinicalTakeaway_ko)}</p>` : ''}
    </div>
    ${renderSection('Limitations', result.limitations, result.limitations_ko)}
    <div class="section">
      <h3>Links</h3>
      <p><a href="${escapeAttribute(paper.pubmedUrl ?? '#')}" target="_blank" rel="noopener">PubMed ${escapeHtml(result.pmid)}</a>${paper.doi ? ` · <a href="https://doi.org/${escapeAttribute(paper.doi)}" target="_blank" rel="noopener">DOI</a>` : ''}</p>
    </div>
  </div>
</details>`;
}

function renderPico(result) {
  const pico = result.pico ?? {};
  const picoKo = result.pico_ko ?? {};
  return `<div class="section">
  <h3>PICO</h3>
  <div class="pico-grid">
    ${picoBox('P', pico.population, picoKo.population)}
    ${picoBox('I', pico.intervention, picoKo.intervention)}
    ${picoBox('C', pico.comparison, picoKo.comparison)}
    ${picoBox('O', pico.outcome, picoKo.outcome)}
  </div>
</div>`;
}

function picoBox(label, english, korean) {
  return `<div class="pico">
  <b>${escapeHtml(label)}</b>
  <p>${escapeHtml(english || '-')}</p>
  ${korean ? `<p class="ko">${escapeHtml(korean)}</p>` : ''}
</div>`;
}

function renderFindings(result) {
  const english = result.keyFindings ?? [];
  const korean = result.keyFindings_ko ?? [];
  const items = english.length ? english : korean;
  if (!items.length) return '';
  return `<div class="section">
  <h3>Key Findings</h3>
  <ul>
    ${items.map((item, index) => `<li>${escapeHtml(item)}${korean[index] && korean[index] !== item ? `<p class="ko">${escapeHtml(korean[index])}</p>` : ''}</li>`).join('\n')}
  </ul>
</div>`;
}

function renderSection(title, english, korean) {
  return `<div class="section">
  <h3>${escapeHtml(title)}</h3>
  <p>${escapeHtml(english || '-')}</p>
  ${korean ? `<p class="ko">${escapeHtml(korean)}</p>` : ''}
</div>`;
}

function renderDays(reports) {
  return `<section class="days">
  ${reports.map((report) => `<details class="day">
    <summary class="day-summary">
      <span class="day-date">${escapeHtml(report.runId)}</span>
      <span class="muted">${escapeHtml(String(report.topPapers?.length ?? 0))} papers</span>
      <span class="muted" style="margin-left:auto">${escapeHtml(formatKst(report.generatedAt))}</span>
    </summary>
    <div class="day-list">
      ${(report.topPapers ?? []).slice(0, 3).map((result, index) => `<div>${index + 1}. ${escapeHtml(result.title)} · PMID ${escapeHtml(result.pmid)}</div>`).join('\n')}
    </div>
  </details>`).join('\n')}
</section>`;
}

function renderJournalArchive(rows) {
  return `<section class="journal">
  <div class="journal-head">
    <span>Recent Journal Archive</span>
    <span class="muted">${escapeHtml(String(rows.length))} entries</span>
  </div>
  <div class="journal-table">
    <table>
      <thead><tr><th>Date</th><th>Journal</th><th>Published</th><th>Article</th></tr></thead>
      <tbody>
        ${rows.map(({ report, result }) => {
          const paper = result.paper ?? {};
          return `<tr>
            <td>${escapeHtml(report.runId)}</td>
            <td><strong>${escapeHtml(paper.journal ?? '')}</strong></td>
            <td>${escapeHtml(paper.pubDate ?? '')}</td>
            <td><a href="${escapeAttribute(paper.pubmedUrl ?? '#')}" target="_blank" rel="noopener">${escapeHtml(result.title)}</a></td>
          </tr>`;
        }).join('\n')}
      </tbody>
    </table>
  </div>
</section>`;
}

function getTotals(reports) {
  return {
    days: reports.length,
    topPapers: reports.reduce((sum, report) => sum + (report.topPapers?.length ?? 0), 0),
  };
}

function stat(label, value) {
  return `<div class="stat"><b>${escapeHtml(String(value))}</b><span>${escapeHtml(label)}</span></div>`;
}

function emptyReport() {
  return {
    runId: 'No run',
    generatedAt: new Date().toISOString(),
    counts: {},
    status: { status: 'empty' },
    topPapers: [],
  };
}

function shortStudyType(studyType = '', evidenceLevel = '') {
  const lower = studyType.toLowerCase();
  if (lower.includes('random')) return 'RCT';
  if (lower.includes('meta')) return 'Meta';
  if (lower.includes('systematic')) return 'SR';
  if (lower.includes('guideline')) return 'Guide';
  if (lower.includes('clinical trial')) return 'Trial';
  if (lower.includes('observational')) return evidenceLevel || 'Obs';
  return evidenceLevel || studyType || 'Review';
}

function formatKst(value) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

