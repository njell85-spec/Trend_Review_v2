import { parseStringPromise } from 'xml2js';
import { fetchWithRetry } from './utils/http.js';

const PMC_EFETCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';

export async function enrichPaperContext({ paper, config, options = {} }) {
  if (options.dryRun || options.skipFullText) return paper;

  const pmcid = normalizePmcid(paper.pmcid);
  if (!pmcid) {
    return {
      ...paper,
      contextSource: {
        type: 'abstract',
        reason: 'No PMCID available for open full-text fetch',
      },
    };
  }

  try {
    const email = process.env.PUBMED_EMAIL || config.topics.search?.pubmed?.email || 'research@example.com';
    const maxChars = Number(config.topics.analysis?.maxFullTextChars ?? 16000);
    const fullText = await fetchPmcFullText({ pmcid, email, maxChars });

    if (!fullText) {
      return {
        ...paper,
        contextSource: {
          type: 'abstract',
          pmcid,
          reason: 'PMC full text was empty or could not be extracted',
        },
      };
    }

    return {
      ...paper,
      fullText,
      contextSource: {
        type: 'pmc',
        pmcid,
        maxChars,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return {
      ...paper,
      contextSource: {
        type: 'abstract',
        pmcid,
        reason: error.message,
      },
    };
  }
}

async function fetchPmcFullText({ pmcid, email, maxChars }) {
  const id = pmcid.replace(/^PMC/i, '');
  const params = new URLSearchParams({
    db: 'pmc',
    id,
    retmode: 'xml',
    tool: 'TrendReviewV2',
    email,
  });

  const response = await fetchWithRetry(`${PMC_EFETCH}?${params}`, {}, { attempts: 2, baseDelayMs: 500 });
  const xmlText = await response.text();
  const xml = await parseStringPromise(xmlText, { explicitArray: false, ignoreAttrs: false });
  const article = xml?.['pmc-articleset']?.article;
  const body = article?.body;
  const back = article?.back;
  const text = [
    sectionText(body),
    sectionText(back?.fn),
  ]
    .filter(Boolean)
    .join('\n\n')
    .replace(/\s+/g, ' ')
    .trim();

  return text.slice(0, maxChars);
}

function normalizePmcid(value = '') {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const match = text.match(/PMC\d+/i);
  return match ? match[0].toUpperCase() : '';
}

function sectionText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(sectionText).filter(Boolean).join('\n');
  if (typeof node !== 'object') return '';

  const label = valueText(node.label);
  const title = valueText(node.title);
  const paragraphs = normalizeArray(node.p).map(valueText).filter(Boolean);
  const sections = normalizeArray(node.sec).map(sectionText).filter(Boolean);

  return [label, title, ...paragraphs, ...sections]
    .filter(Boolean)
    .join('\n');
}

function valueText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(' ');
  if (typeof value !== 'object') return '';
  if (value._) return String(value._);
  return Object.entries(value)
    .filter(([key]) => key !== '$')
    .map(([, nested]) => valueText(nested))
    .filter(Boolean)
    .join(' ');
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
