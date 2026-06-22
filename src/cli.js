#!/usr/bin/env node
import { runPipeline } from './pipeline.js';

const options = parseArgs(process.argv.slice(2));

try {
  const run = await runPipeline(options);
  const counts = run.status.counts;
  console.log(`Trend Review ${run.runId}: ${run.status.status}`);
  console.log(`Fetched ${counts.fetched ?? 0}, screened ${counts.screened ?? 0}, analyzed ${counts.analyzed ?? 0}`);
  if (run.status.outputs?.publicIndex) {
    console.log(`Dashboard: ${run.status.outputs.publicIndex}`);
  }
} catch (error) {
  console.error(`Trend Review failed: ${error.message}`);
  process.exitCode = 1;
}

function parseArgs(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--no-notify') options.noNotify = true;
    else if (arg === '--skip-llm') options.skipLlm = true;
    else if (arg === '--ignore-seen') options.ignoreSeen = true;
    else if (arg === '--no-seen-update') options.noSeenUpdate = true;
    else if (arg === '--date') {
      options.date = next;
      index += 1;
    } else if (arg === '--days') {
      options.days = Number(next);
      index += 1;
    } else if (arg === '--max-papers') {
      options.maxPapers = Number(next);
      index += 1;
    } else if (arg === '--top-n') {
      options.topN = Number(next);
      index += 1;
    } else if (arg === '--candidate-limit') {
      options.candidateLimit = Number(next);
      index += 1;
    } else if (arg === '--llm-provider') {
      options.llmProvider = next;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Trend Review v2

Usage:
  node src/cli.js [options]

Options:
  --dry-run              Use fixtures/papers.json and do not call PubMed or LLM
  --no-notify            Skip notification providers
  --skip-llm             Use fallback summaries even in live runs
  --ignore-seen          Do not filter data/seen_pmids.json
  --no-seen-update       Do not write collected PMIDs to seen_pmids.json
  --date YYYY-MM-DD      Run date id
  --days N               PubMed search window
  --max-papers N         PubMed retmax
  --candidate-limit N    Number of screened candidates kept
  --top-n N              Number of papers to analyze
  --llm-provider NAME    gemini, openai, anthropic, or none
`);
}
