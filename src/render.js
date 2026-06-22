import path from 'node:path';
import { readdir } from 'node:fs/promises';
import { readJson, writeJson, writeText } from './utils/fs.js';
import { renderArchiveDashboard } from './render/archiveDashboard.js';

export async function renderOutputs({ run, config }) {
  const report = buildReport(run, config);
  const reportBase = path.join(process.cwd(), 'reports', run.runId);
  const publicDir = path.join(process.cwd(), 'public');
  const jsonPath = `${reportBase}.json`;
  const mdPath = `${reportBase}.md`;
  const htmlPath = `${reportBase}.html`;

  await writeJson(jsonPath, report);
  const archiveReports = await loadArchiveReports(report);
  const archiveHtml = renderArchiveDashboard(archiveReports);

  await Promise.all([
    writeText(mdPath, renderMarkdown(report)),
    writeText(htmlPath, renderArchiveDashboard([report])),
    writeText(path.join(publicDir, 'index.html'), archiveHtml),
    writeJson(path.join(publicDir, 'latest.json'), report),
    writeJson(path.join(publicDir, 'status.json'), run.status),
  ]);

  return {
    report,
    outputs: {
      json: `reports/${run.runId}.json`,
      markdown: `reports/${run.runId}.md`,
      html: `reports/${run.runId}.html`,
      publicIndex: 'public/index.html',
      latestJson: 'public/latest.json',
      statusJson: 'public/status.json',
    },
  };
}

async function loadArchiveReports(currentReport) {
  const reportsDir = path.join(process.cwd(), 'reports');
  const byRunId = new Map([[currentReport.runId, currentReport]]);

  try {
    const entries = await readdir(reportsDir, { withFileTypes: true });
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && /^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name))
      .map((entry) => path.join(reportsDir, entry.name));

    for (const filePath of jsonFiles) {
      const report = await readJson(filePath, null);
      if (report?.runId) byRunId.set(report.runId, report);
    }
  } catch {
    return [currentReport];
  }

  return [...byRunId.values()].sort((a, b) => String(b.runId).localeCompare(String(a.runId)));
}

function buildReport(run, config) {
  const dashboardUrl = config.delivery.dashboard?.publicBaseUrl || process.env.DASHBOARD_URL || '';
  return {
    runId: run.runId,
    generatedAt: run.finishedAt ?? new Date().toISOString(),
    dashboardUrl,
    status: run.status,
    counts: run.status.counts,
    query: run.collect?.stats?.query ?? config.topics.search?.pubmed?.query,
    searchWindow: {
      days: run.options.days ?? config.topics.search?.days,
      minDate: run.collect?.stats?.minDate,
      maxDate: run.collect?.stats?.maxDate,
    },
    topPapers: run.analysis?.analyses ?? [],
    candidates: run.screen?.candidates ?? [],
    excludedCount: run.screen?.excluded?.length ?? 0,
    errors: run.status.errors ?? [],
  };
}

function renderMarkdown(report) {
  const lines = [
    `# Trend Review ${report.runId}`,
    '',
    `Status: ${report.status.status}`,
    `Generated: ${formatKst(report.generatedAt)}`,
    '',
    `Fetched: ${report.counts.fetched ?? 0} / Screened candidates: ${report.counts.screened ?? 0} / Analyzed: ${report.counts.analyzed ?? 0}`,
    '',
    '## Top Papers',
    '',
  ];

  for (const [index, result] of report.topPapers.entries()) {
    const paper = result.paper ?? {};
    lines.push(`### ${index + 1}. ${result.title}`);
    lines.push('');
    lines.push(`- PMID: ${result.pmid}`);
    lines.push(`- Journal: ${paper.journal ?? ''} (${paper.pubDate ?? ''})`);
    lines.push(`- Summary: ${result.oneLineSummary_ko}`);
    lines.push(`- Takeaway: ${result.clinicalTakeaway_ko}`);
    lines.push(`- PubMed: ${paper.pubmedUrl ?? ''}`);
    lines.push('');
  }

  if (report.errors.length) {
    lines.push('## Errors');
    lines.push('');
    for (const error of report.errors) {
      lines.push(`- ${error.step ?? 'unknown'} ${error.pmid ? `PMID ${error.pmid}` : ''}: ${error.message}`);
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function formatKst(value) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

