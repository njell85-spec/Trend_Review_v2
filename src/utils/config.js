import { readFile } from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import dotenv from 'dotenv';

dotenv.config();

const ROOT = process.cwd();

export async function loadConfig() {
  const [topicsText, deliveryText] = await Promise.all([
    readFile(path.join(ROOT, 'config', 'topics.yml'), 'utf8'),
    readFile(path.join(ROOT, 'config', 'delivery.yml'), 'utf8'),
  ]);

  const topics = expandEnv(YAML.parse(topicsText));
  const delivery = expandEnv(YAML.parse(deliveryText));
  return { topics, delivery };
}

function expandEnv(value) {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => process.env[name] ?? '');
  }
  if (Array.isArray(value)) return value.map(expandEnv);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, expandEnv(inner)]));
  }
  return value;
}

