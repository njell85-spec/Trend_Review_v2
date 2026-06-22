export function renderArchiveDashboard(reports) {
  const safeReports = reports.length ? reports : [emptyReport()];
  const latest = safeReports[0];
  const totals = getTotals(safeReports);

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Trend Review</title>
  <style>
    :root {
      --ink: #17202f;
      --muted: #667084;
      --line: #dde5ee;
      --page: #f5f7fb;
      --paper: #ffffff;
      --teal: #0f766e;
      --blue: #28559a;
      --violet: #684a8e;
      --amber: #90661c;
      --red: #a9473e;
      --soft-teal: #e7f4f1;
      --soft-blue: #edf3ff;
      --soft-violet: #f2edfa;
      --soft-amber: #fff5df;
      --soft-red: #fff0ee;
      --shadow: 0 12px 32px rgba(23, 32, 47, .08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--page);
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.55;
    }
    a {
      color: var(--blue);
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
    }
    .wrap {
      width: min(100% - 28px, 980px);
      margin: 0 auto;
    }
    .mast {
      background: linear-gradient(180deg, #fff, #f9fbfd);
      border-bottom: 1px solid var(--line);
    }
    .mast-inner {
      padding: 22px 0 18px;
      display: grid;
      gap: 16px;
    }
    .topline {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }
    h1 {
      margin: 0;
      font-size: clamp(1.7rem, 5vw, 2.45rem);
      line-height: 1.06;
      letter-spacing: 0;
    }
    .subtitle {
      margin: 8px 0 0;
      color: var(--muted);
      font-size: .94rem;
      max-width: 58rem;
    }
    .run-state {
      display: grid;
      justify-items: end;
      gap: 3px;
      color: var(--muted);
      font-size: .78rem;
      white-space: nowrap;
      padding-top: 2px;
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
      min-width: 0;
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 11px 12px;
    }
    .stat b {
      display: block;
      font-size: 1.35rem;
      line-height: 1.1;
    }
    .stat span {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: .74rem;
    }
    main {
      padding: 16px 0 36px;
      display: grid;
      gap: 12px;
    }
    details {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    details[open] {
      box-shadow: var(--shadow);
    }
    summary {
      list-style: none;
      cursor: pointer;
    }
    summary::-webkit-details-marker { display: none; }
    .day-summary {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 13px 14px;
      background: linear-gradient(90deg, #fff, #f8fbfd);
      border-bottom: 1px solid transparent;
    }
    details[open] > .day-summary {
      border-bottom-color: var(--line);
    }
    .day-title {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      min-width: 0;
    }
    .date {
      font-weight: 850;
      font-size: 1.02rem;
    }
    .chevron {
      width: 27px;
      height: 27px;
      border-radius: 999px;
      display: inline-grid;
      place-items: center;
      background: var(--soft-blue);
      color: var(--blue);
      font-weight: 900;
      transition: transform .15s ease;
    }
    details[open] > summary .chevron {
      transform: rotate(90deg);
    }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: #fff;
      color: var(--ink);
      font-size: .74rem;
      font-weight: 720;
      white-space: nowrap;
    }
    .pill.teal { border-color: #bfe0d9; background: var(--soft-teal); color: var(--teal); }
    .pill.blue { border-color: #cddbf7; background: var(--soft-blue); color: var(--blue); }
    .pill.amber { border-color: #efd8a8; background: var(--soft-amber); color: var(--amber); }
    .day-body {
      padding: 12px;
      display: grid;
      gap: 10px;
      background: #fbfcfe;
    }
    .paper {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    .paper[open] {
      border-color: rgba(15, 118, 110, .45);
      box-shadow: none;
    }
    .paper-summary {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      padding: 13px;
    }
    .paper-title {
      margin: 0;
      font-size: clamp(.98rem, 2.4vw, 1.18rem);
      line-height: 1.32;
      font-weight: 850;
      letter-spacing: 0;
    }
    .paper-meta {
      margin-top: 5px;
      color: var(--muted);
      font-size: .8rem;
    }
    .paper-body {
      border-top: 1px solid var(--line);
      padding: 13px;
      display: grid;
      gap: 12px;
      background: #fbfcfe;
    }
    .section {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    .section-head {
      padding: 10px 11px;
      border-bottom: 1px solid var(--line);
      display: flex;
      justify-content: space-between;
      gap: 10px;
      align-items: baseline;
    }
    .section h3 {
      margin: 0;
      font-size: .86rem;
      letter-spacing: 0;
    }
    .section-sub {
      color: var(--muted);
      font-size: .72rem;
      white-space: nowrap;
    }
    .section-body {
      padding: 11px;
      display: grid;
      gap: 8px;
    }
    .en {
      margin: 0;
      font-size: .91rem;
    }
    .ko {
      margin: 0;
      color: #526075;
      font-size: .86rem;
    }
    .why {
      border-left: 4px solid var(--teal);
      background: linear-gradient(90deg, var(--soft-teal), #fff);
    }
    .pico-grid {
      display: grid;
      gap: 8px;
    }
    .pico-row {
      display: grid;
      grid-template-columns: 36px 1fr;
      border: 1px solid #e3e9f2;
      border-radius: 8px;
      overflow: hidden;
      background: #fff;
    }
    .pico-label {
      display: grid;
      place-items: center;
      background: #f0f4f8;
      color: var(--blue);
      font-weight: 850;
    }
    .pico-content {
      padding: 9px 10px;
      display: grid;
      gap: 5px;
    }
    .pico-name {
      color: var(--muted);
      font-size: .72rem;
      font-weight: 790;
      text-transform: uppercase;
    }
    .outcomes {
      display: grid;
      gap: 8px;
      margin-top: 4px;
    }
    .outcome {
      border: 1px solid #d8e4f3;
      border-radius: 8px;
      background: #fbfdff;
      padding: 10px;
      display: grid;
      gap: 5px;
    }
    .outcome-label {
      color: var(--blue);
      font-size: .8rem;
      font-weight: 850;
    }
    .stat-line {
      color: #324259;
      font-size: .83rem;
      font-weight: 720;
    }
    .interpretation {
      margin-top: 2px;
      padding: 8px 9px;
      border-radius: 7px;
      background: #f3f6fb;
      color: #536076;
      font-size: .76rem;
      line-height: 1.45;
    }
    .primer {
      background: #fff8e8;
      color: #6c5520;
      border: 1px solid #ead8a7;
    }
    .points {
      margin: 0;
      padding-left: 1.1rem;
      display: grid;
      gap: 6px;
    }
    .bottom {
      background: #121a27;
      color: #f8fafc;
      border-color: #121a27;
    }
    .bottom .section-head {
      border-bottom-color: rgba(255,255,255,.14);
    }
    .bottom .ko {
      color: #cbd5e1;
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: .82rem;
    }
    footer {
      border-top: 1px solid var(--line);
      padding: 18px 0 28px;
      color: var(--muted);
      text-align: center;
      font-size: .78rem;
    }
    @media (max-width: 720px) {
      .wrap { width: min(100% - 22px, 980px); }
      .topline,
      .day-summary,
      .paper-summary {
        grid-template-columns: 1fr;
      }
      .run-state {
        justify-items: start;
        white-space: normal;
      }
      .stats {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .chevron {
        justify-self: end;
      }
    }
  </style>
</head>
<body>
  <header class="mast">
    <div class="wrap mast-inner">
      <div class="topline">
        <div>
          <h1>EM/CCM Trend Review</h1>
          <p class="subtitle">PubMed 후보 30개에서 Gemini가 1개를 선정하고, 공개 원문이 있으면 PMC 본문까지 반영해 분석합니다.</p>
        </div>
        <div class="run-state">
          <strong>${escapeHtml(latest.status?.status ?? 'ready')}</strong>
          <span>${escapeHtml(formatKst(latest.generatedAt))}</span>
        </div>
      </div>
      <div class="stats">
        ${stat('Archive Days', totals.days)}
        ${stat('Latest Fetched', latest.counts?.fetched ?? 0)}
        ${stat('Latest Screened', latest.counts?.screened ?? 0)}
        ${stat('Latest Reports', latest.topPapers?.length ?? 0)}
      </div>
    </div>
  </header>
  <main class="wrap">
    ${safeReports.map((report, index) => renderDay(report, index === 0)).join('\n')}
  </main>
  <footer>
    Trend Review v2 · PubMed / PMC / Gemini · Reading aid, not a clinical decision system
  </footer>
</body>
</html>`;
}

function renderDay(report, isLatest) {
  const papers = report.topPapers ?? [];
  const selection = report.status?.counts?.fallback ? `${report.status.counts.fallback} fallback` : 'LLM analysis';
  const latestBadge = isLatest ? '\n      <span class="pill teal">Latest</span>' : '';

  return `<details class="day"${isLatest ? ' open' : ''}>
  <summary class="day-summary">
    <div class="day-title">
      <span class="date">${escapeHtml(report.runId)}</span>${latestBadge}
      <span class="pill blue">${escapeHtml(String(papers.length))} report</span>
      <span class="pill">${escapeHtml(report.searchWindow?.days ?? '')}-day window</span>
      <span class="pill amber">${escapeHtml(selection)}</span>
    </div>
    <span class="chevron">›</span>
  </summary>
  <div class="day-body">
    ${papers.length ? papers.map((result, index) => renderPaper(result, index)).join('\n') : renderEmptyPaper()}
  </div>
</details>`;
}

function renderPaper(result, index) {
  const paper = result.paper ?? {};
  const studyType = shortStudyType(paper.screeningData?.studyType ?? '', result.evidenceLevel);
  const context = contextLabel(paper.contextSource);

  return `<details class="paper">
  <summary class="paper-summary">
    <div>
      <h2 class="paper-title">${escapeHtml(result.title)}</h2>
      <div class="paper-meta">
        ${escapeHtml(paper.journal ?? '')} · ${escapeHtml(paper.pubDate ?? '')} · PMID ${escapeHtml(result.pmid)}
      </div>
    </div>
    <div class="day-title">
      <span class="pill teal">#${index + 1}</span>
      <span class="pill blue">${escapeHtml(studyType)}</span>
      <span class="pill">${escapeHtml(context)}</span>
      <span class="chevron">›</span>
    </div>
  </summary>
  <div class="paper-body">
    ${renderTextSection('Why It Matters', 'clinical relevance', result.whyItMatters || result.clinicalQuestion || result.oneLineSummary, result.whyItMatters_ko || result.clinicalQuestion_ko || result.oneLineSummary_ko, 'why')}
    ${renderStudyDetails(result)}
    ${renderDetailedPico(result)}
    ${renderFindings(result)}
    ${renderTextSection('Conclusion', 'author-level conclusion', result.conclusion || result.clinicalTakeaway, result.conclusion_ko || result.clinicalTakeaway_ko)}
    ${renderTextSection('Limitations', 'what weakens confidence', result.limitations, result.limitations_ko)}
    ${renderTextSection('ED / ICU Applicability', 'practice consideration', result.edIcuApplicability || result.clinicalTakeaway, result.edIcuApplicability_ko || result.clinicalTakeaway_ko)}
    ${renderTextSection('Bottom Line', 'mobile summary', result.clinicalTakeaway || result.oneLineSummary, result.clinicalTakeaway_ko || result.oneLineSummary_ko, 'bottom')}
    ${renderLinks(result)}
  </div>
</details>`;
}

function renderStudyDetails(result) {
  const details = result.studyDetails;
  if (!details) return '';

  const rows = [
    ['Design', details.design, details.design_ko],
    ['Setting', details.setting, details.setting_ko],
    ['Sample Size', details.sampleSize, details.sampleSize_ko],
    ['Eligibility', details.eligibility, details.eligibility_ko],
    ['Intervention Details', details.interventionDetails, details.interventionDetails_ko],
    ['Comparator Details', details.comparatorDetails, details.comparatorDetails_ko],
    ['Follow-up', details.followUp, details.followUp_ko],
    ['Source Basis', details.sourceBasis, details.sourceBasis_ko],
  ];

  return `<section class="section">
  <div class="section-head">
    <h3>Study Details</h3>
    <span class="section-sub">methods and source basis</span>
  </div>
  <div class="section-body pico-grid">
    ${rows.map(([label, english, korean]) => detailRow(label, english, korean)).join('\n')}
  </div>
</section>`;
}

function detailRow(label, english, korean) {
  return `<div class="pico-row">
    <div class="pico-label">${escapeHtml(label.slice(0, 1))}</div>
    <div class="pico-content">
      <div class="pico-name">${escapeHtml(label)}</div>
      <p class="en">${escapeHtml(english || '-')}</p>
      ${korean ? `<p class="ko">${escapeHtml(korean)}</p>` : ''}
    </div>
  </div>`;
}

function renderDetailedPico(result) {
  const detailed = result.detailedPico;
  if (!detailed) return renderLegacyPico(result);

  return `<section class="section">
  <div class="section-head">
    <h3>PICO</h3>
    <span class="section-sub">English first, Korean paired</span>
  </div>
  <div class="section-body pico-grid">
    ${picoRow('P', 'Population', detailed.population, detailed.population_ko, detailed.countrySetting, detailed.countrySetting_ko)}
    ${picoRow('I', 'Intervention', detailed.intervention, detailed.intervention_ko)}
    ${picoRow('C', 'Comparator', detailed.comparator, detailed.comparator_ko)}
    ${outcomeRows(detailed.outcomes ?? [])}
  </div>
</section>`;
}

function renderLegacyPico(result) {
  const pico = result.pico ?? {};
  const picoKo = result.pico_ko ?? {};

  return `<section class="section">
  <div class="section-head">
    <h3>PICO</h3>
    <span class="section-sub">legacy format</span>
  </div>
  <div class="section-body pico-grid">
    ${picoRow('P', 'Population', pico.population, picoKo.population)}
    ${picoRow('I', 'Intervention', pico.intervention, picoKo.intervention)}
    ${picoRow('C', 'Comparison', pico.comparison, picoKo.comparison)}
    ${picoRow('O', 'Outcome', pico.outcome, picoKo.outcome)}
  </div>
</section>`;
}

function picoRow(label, name, english, korean, secondaryEnglish = '', secondaryKorean = '') {
  const optionalLines = [
    korean ? `<p class="ko">${escapeHtml(korean)}</p>` : null,
    secondaryEnglish ? `<p class="en"><strong>Setting:</strong> ${escapeHtml(secondaryEnglish)}</p>` : null,
    secondaryKorean ? `<p class="ko">${escapeHtml(secondaryKorean)}</p>` : null,
  ].filter(Boolean);

  return `<div class="pico-row">
    <div class="pico-label">${escapeHtml(label)}</div>
    <div class="pico-content">
      <div class="pico-name">${escapeHtml(name)}</div>
      <p class="en">${escapeHtml(english || '-')}</p>${optionalLines.length ? `\n      ${optionalLines.join('\n      ')}` : ''}
    </div>
  </div>`;
}

function outcomeRows(outcomes) {
  return `<div class="pico-row">
    <div class="pico-label">O</div>
    <div class="pico-content">
      <div class="pico-name">Outcomes</div>
      <div class="outcomes">
        ${outcomes.map(renderOutcome).join('\n')}
      </div>
    </div>
  </div>`;
}

function renderOutcome(outcome) {
  const resultKo = outcome.result_ko ? `\n    <p class="ko">${escapeHtml(outcome.result_ko)}</p>` : '';
  const interpretationKo = outcome.interpretation_ko ? `<br>${escapeHtml(outcome.interpretation_ko)}` : '';
  const primerKo = outcome.statPrimer_ko ? `<br>${escapeHtml(outcome.statPrimer_ko)}` : '';
  const primer = outcome.statPrimer
    ? `\n    <div class="interpretation primer">ⓘ ${escapeHtml(outcome.statPrimer)}${primerKo}</div>`
    : '';

  return `<div class="outcome">
    <div class="outcome-label">${escapeHtml(outcome.label)}</div>
    <p class="en">${escapeHtml(outcome.outcome)}</p>
    <p class="ko">${escapeHtml(outcome.outcome_ko)}</p>
    <p class="stat-line">${escapeHtml(outcome.result)}${outcome.statistics ? ` · ${escapeHtml(outcome.statistics)}` : ''}</p>${resultKo}
    <div class="interpretation">ⓘ ${escapeHtml(outcome.interpretation)}${interpretationKo}</div>${primer}
  </div>`;
}

function renderFindings(result) {
  const english = result.keyFindings ?? [];
  const korean = result.keyFindings_ko ?? [];
  if (!english.length && !korean.length) return '';

  return `<section class="section">
  <div class="section-head">
    <h3>Key Findings</h3>
    <span class="section-sub">reported results</span>
  </div>
  <div class="section-body">
    <ul class="points">
      ${(english.length ? english : korean).map((item, index) => `<li><p class="en">${escapeHtml(item)}</p>${korean[index] && korean[index] !== item ? `<p class="ko">${escapeHtml(korean[index])}</p>` : ''}</li>`).join('\n')}
    </ul>
  </div>
</section>`;
}

function renderTextSection(title, subtitle, english, korean, className = '') {
  const koreanLine = korean ? `\n    <p class="ko">${escapeHtml(korean)}</p>` : '';

  return `<section class="section ${className}">
  <div class="section-head">
    <h3>${escapeHtml(title)}</h3>
    <span class="section-sub">${escapeHtml(subtitle)}</span>
  </div>
  <div class="section-body">
    <p class="en">${escapeHtml(english || '-')}</p>${koreanLine}
  </div>
</section>`;
}

function renderLinks(result) {
  const paper = result.paper ?? {};
  const links = [];
  if (paper.pubmedUrl) links.push(`<a href="${escapeAttribute(paper.pubmedUrl)}" target="_blank" rel="noopener">PubMed</a>`);
  if (paper.doi) links.push(`<a href="https://doi.org/${escapeAttribute(paper.doi)}" target="_blank" rel="noopener">DOI</a>`);
  if (paper.pmcid) links.push(`<a href="https://pmc.ncbi.nlm.nih.gov/articles/${escapeAttribute(paper.pmcid)}/" target="_blank" rel="noopener">PMC</a>`);
  for (const nctId of paper.nctIds ?? []) {
    links.push(`<a href="https://clinicaltrials.gov/study/${escapeAttribute(nctId)}" target="_blank" rel="noopener">${escapeHtml(nctId)}</a>`);
  }
  for (const source of paper.geminiGroundingSources ?? []) {
    links.push(`<a href="${escapeAttribute(source.uri)}" target="_blank" rel="noopener">Search: ${escapeHtml(source.title)}</a>`);
  }

  return `<section class="section">
    <div class="section-head">
      <h3>Links</h3>
      <span class="section-sub">source</span>
    </div>
    <div class="section-body links">${links.join(' · ') || '-'}</div>
  </section>`;
}

function renderEmptyPaper() {
  return `<div class="paper">
    <div class="paper-summary">
      <div>
        <h2 class="paper-title">No selected paper</h2>
        <div class="paper-meta">No report was generated for this date.</div>
      </div>
    </div>
  </div>`;
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
  if (lower.includes('meta')) return 'Meta-analysis';
  if (lower.includes('systematic')) return 'Systematic review';
  if (lower.includes('guideline')) return 'Guideline';
  if (lower.includes('clinical trial')) return 'Clinical trial';
  if (lower.includes('observational')) return evidenceLevel || 'Observational';
  return evidenceLevel || studyType || 'Review';
}

function contextLabel(contextSource = {}) {
  if (contextSource.type === 'pmc+metadata') return 'PMC + metadata';
  if (contextSource.type === 'pmc') return 'PMC full text';
  if (contextSource.type === 'public-metadata') return 'Abstract + metadata';
  if (contextSource.type === 'abstract') return 'Abstract only';
  return 'Source context';
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
