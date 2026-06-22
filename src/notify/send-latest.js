#!/usr/bin/env node
import path from 'node:path';
import dotenv from 'dotenv';
import { loadConfig } from '../utils/config.js';
import { readJson } from '../utils/fs.js';
import { notify } from './index.js';

dotenv.config();

const reportPath = path.join(process.cwd(), 'public', 'latest.json');
const report = await readJson(reportPath, null);

if (!report) {
  throw new Error(`Latest report not found: ${reportPath}`);
}

const config = await loadConfig();
const results = await notify({ report, config, options: {} });

console.log(JSON.stringify(results, null, 2));
