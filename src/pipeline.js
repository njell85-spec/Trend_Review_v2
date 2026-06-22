import path from 'node:path';
import { collectPapers } from './collect.js';
import { screenPapers } from './screen.js';
import { analyzeTopPapers } from './analyze.js';
import { renderOutputs } from './render.js';
import { notify } from './notify/index.js';
import { todayKst, isoNow } from './utils/date.js';
import { ensureDir, readJson, writeJson } from './utils/fs.js';
import { loadConfig } from './utils/config.js';

export async function runPipeline(options = {}) {
  const config = await loadConfig();
  const runId = options.date || todayKst();
  const run = {
    runId,
    startedAt: isoNow(),
    finishedAt: null,
    options: publicOptions(options),
    collect: null,
    screen: null,
    analysis: null,
    render: null,
    notifications: [],
    status: {
      runId,
      status: 'running',
      step: 'init',
      startedAt: isoNow(),
      finishedAt: null,
      counts: {},
      outputs: {},
      errors: [],
    },
  };

  await ensureProjectDirs();
  const saveStatus = () => saveRunStatus(run);
  await saveStatus();

  try {
    run.status.step = 'collect';
    await saveStatus();
    run.collect = await collectPapers({ config, options });
    run.status.counts.fetched = run.collect.papers.length;
    await writeJson(runFile(runId, 'collect'), run.collect);
    await saveStatus();

    run.status.step = 'screen';
    await saveStatus();
    const seenPmids = await readJson(path.join(process.cwd(), 'data', 'seen_pmids.json'), []);
    run.screen = screenPapers({
      papers: run.collect.papers,
      seenPmids,
      config,
      options: {
        ...options,
        ignoreSeen: options.ignoreSeen || options.dryRun,
      },
    });
    run.status.counts.screened = run.screen.candidates.length;
    await writeJson(runFile(runId, 'screen'), run.screen);
    await saveStatus();

    run.status.step = 'analyze';
    await saveStatus();
    run.analysis = await analyzeTopPapers({
      candidates: run.screen.candidates,
      config,
      options,
    });
    run.status.counts.analyzed = run.analysis.analyses.length;
    run.status.counts.fallback = run.analysis.stats.fallbackCount;
    run.status.errors.push(...run.analysis.errors);
    await writeJson(runFile(runId, 'analysis'), run.analysis);
    await saveStatus();

    run.status.step = 'render';
    await saveStatus();
    run.finishedAt = isoNow();
    run.status.status = 'success';
    run.status.finishedAt = run.finishedAt;
    const firstRender = await renderOutputs({ run, config });
    run.render = firstRender;
    run.status.outputs = firstRender.outputs;
    await saveStatus();

    run.status.step = 'notify';
    await saveStatus();
    run.notifications = await notify({ report: firstRender.report, config, options });
    run.status.notifications = run.notifications;
    await saveStatus();

    if (!options.dryRun && !options.noSeenUpdate) {
      await updateSeenPmids(run.analysis.analyses);
    }

    run.status.step = 'done';
    run.status.finishedAt = run.finishedAt;
    await saveStatus();
    const finalRender = await renderOutputs({ run, config });
    run.render = finalRender;
    run.status.outputs = finalRender.outputs;
    await saveStatus();

    return run;
  } catch (error) {
    run.finishedAt = isoNow();
    run.status.status = 'failed';
    run.status.finishedAt = run.finishedAt;
    run.status.errors.push({
      step: run.status.step,
      message: error.message,
    });
    await saveStatus();
    throw error;
  }
}

async function ensureProjectDirs() {
  await Promise.all([
    ensureDir(path.join(process.cwd(), 'data', 'runs')),
    ensureDir(path.join(process.cwd(), 'reports')),
    ensureDir(path.join(process.cwd(), 'public')),
  ]);
}

async function saveRunStatus(run) {
  await writeJson(runFile(run.runId, 'status'), run.status);
  await writeJson(path.join(process.cwd(), 'public', 'status.json'), run.status);
}

function runFile(runId, suffix) {
  return path.join(process.cwd(), 'data', 'runs', `${runId}.${suffix}.json`);
}

async function updateSeenPmids(selectedAnalyses) {
  const filePath = path.join(process.cwd(), 'data', 'seen_pmids.json');
  const previous = await readJson(filePath, []);
  const next = new Set(previous.map(String));
  for (const analysis of selectedAnalyses) next.add(String(analysis.pmid));
  await writeJson(filePath, [...next].sort());
}

function publicOptions(options) {
  const safe = { ...options };
  delete safe.query;
  return safe;
}
