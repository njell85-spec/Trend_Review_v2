#!/usr/bin/env node
import path from 'node:path';
import dotenv from 'dotenv';
import { loadConfig } from '../utils/config.js';
import { ensureDir, readJson, writeJson } from '../utils/fs.js';
import { notify } from './index.js';

dotenv.config();

const options = parseArgs(process.argv.slice(2));
const reportPath = path.join(process.cwd(), 'public', 'latest.json');
const report = await readJson(reportPath, null);

if (!report) {
  throw new Error(`Latest report not found: ${reportPath}`);
}

const runId = report.runId || report.status?.runId;
if (!runId) {
  throw new Error('Latest report does not include a runId.');
}

const markerPath = path.join(process.cwd(), 'data', 'notifications', `${runId}.json`);
const existingMarker = await readJson(markerPath, null);
if (existingMarker?.status === 'sent' && !options.force) {
  console.log(JSON.stringify({
    provider: 'all',
    status: 'skipped',
    reason: `notification marker already exists for ${runId}`,
    markerPath,
  }, null, 2));
  process.exit(0);
}

const config = await loadConfig();
const results = await notify({ report, config, options: {} });
const sent = results.some((result) => result.status === 'sent');

console.log(JSON.stringify(results, null, 2));

if (!sent) {
  process.exitCode = 1;
} else {
  await ensureDir(path.dirname(markerPath));
  await writeJson(markerPath, {
    runId,
    status: 'sent',
    sentAt: new Date().toISOString(),
    reportPath,
    results,
  });
}

function parseArgs(args) {
  return {
    force: args.includes('--force'),
  };
}
