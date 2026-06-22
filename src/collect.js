import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { parseStringPromise } from 'xml2js';
import { pubmedDateRange } from './utils/date.js';
import { fetchWithRetry, sleep } from './utils/http.js';

const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export async function collectPapers({ config, options }) {
  if (options.dryRun) {
    const fixturePath = path.join(process.cwd(), 'fixtures', 'papers.json');
    const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
    return {
      papers: fixture,
      stats: {
        source: 'fixture',
        pmidsFound: fixture.length,
        articlesCollected: fixture.length,
      },
    };
  }

  const search = config.topics.search;
  const pubmed = search.pubmed ?? {};
  const email = process.env.PUBMED_EMAIL || pubmed.email || 'research@example.com';
  const apiKey = process.env.PUBMED_API_KEY || '';
  const maxPapers = Number(options.maxPapers ?? search.maxPapers ?? 50);
  const days = Number(options.days ?? search.days ?? 30);
  const query = options.query || pubmed.query;
  const { minDate, maxDate } = pubmedDateRange(days, options.date);

  const pmids = await searchPmids({ query, maxPapers, minDate, maxDate, email, apiKey });
  const papers = await fetchArticles({ pmids, email, apiKey });

  return {
    papers,
    stats: {
      source: 'pubmed',
      query,
      minDate,
      maxDate,
      pmidsFound: pmids.length,
      articlesCollected: papers.length,
      withAbstracts: papers.filter((paper) => paper.abstract?.length > 50).length,
    },
  };
}

async function searchPmids({ query, maxPapers, minDate, maxDate, email, apiKey }) {
  const params = pubmedParams({
    db: 'pubmed',
    term: query,
    retmax: String(maxPapers),
    mindate: minDate,
    maxdate: maxDate,
    datetype: 'pdat',
    retmode: 'json',
    sort: 'date',
    email,
    apiKey,
  });

  const response = await fetchWithRetry(`${PUBMED_BASE}/esearch.fcgi?${params}`);
  const data = await response.json();
  return data?.esearchresult?.idlist ?? [];
}

async function fetchArticles({ pmids, email, apiKey }) {
  const batchSize = 20;
  const papers = [];

  for (let index = 0; index < pmids.length; index += batchSize) {
    const batch = pmids.slice(index, index + batchSize);
    const params = pubmedParams({
      db: 'pubmed',
      id: batch.join(','),
      rettype: 'abstract',
      retmode: 'xml',
      email,
      apiKey,
    });

    const response = await fetchWithRetry(`${PUBMED_BASE}/efetch.fcgi?${params}`);
    const xmlText = await response.text();
    const xml = await parseStringPromise(xmlText, { explicitArray: false, ignoreAttrs: false });
    papers.push(...parsePubmedArticles(xml));

    if (!apiKey && index + batchSize < pmids.length) {
      await sleep(350);
    }
  }

  return papers;
}

function pubmedParams({ email, apiKey, ...extra }) {
  const params = new URLSearchParams({
    tool: 'TrendReviewV2',
    email,
    ...extra,
  });
  if (apiKey) params.set('api_key', apiKey);
  return params.toString();
}

export function parsePubmedArticles(xml) {
  const set = xml?.PubmedArticleSet?.PubmedArticle;
  const items = Array.isArray(set) ? set : set ? [set] : [];
  return items.map(parseArticle).filter(Boolean);
}

function parseArticle(item) {
  try {
    const medline = item?.MedlineCitation;
    const article = medline?.Article;
    if (!article) return null;

    const pmid = valueOf(medline?.PMID);
    const title = normalizeText(valueOf(article?.ArticleTitle));
    const abstract = parseAbstract(article?.Abstract?.AbstractText);
    const journal = article?.Journal;
    const articleIds = normalizeArray(item?.PubmedData?.ArticleIdList?.ArticleId);
    const publicationTypes = normalizeArray(article?.PublicationTypeList?.PublicationType)
      .map(valueOf)
      .filter(Boolean);

    return {
      pmid: String(pmid),
      title,
      abstract,
      authors: parseAuthors(article?.AuthorList?.Author),
      journal: String(journal?.Title ?? journal?.ISOAbbreviation ?? ''),
      pubDate: parsePubDate(journal?.JournalIssue?.PubDate),
      publicationTypes,
      meshTerms: parseMesh(medline?.MeshHeadingList?.MeshHeading),
      keywords: parseKeywords(medline?.KeywordList),
      doi: findArticleId(articleIds, 'doi'),
      pmcid: findArticleId(articleIds, 'pmc'),
      pubmedUrl: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      collectedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function parseAbstract(abstractText) {
  const parts = normalizeArray(abstractText);
  return parts
    .map((part) => {
      const label = part?.$?.Label ? `${part.$.Label}: ` : '';
      return normalizeText(`${label}${valueOf(part)}`);
    })
    .filter(Boolean)
    .join('\n');
}

function parseAuthors(authorList) {
  return normalizeArray(authorList)
    .slice(0, 8)
    .map((author) => `${author?.LastName ?? ''} ${author?.Initials ?? ''}`.trim())
    .filter(Boolean);
}

function parseMesh(meshList) {
  return normalizeArray(meshList)
    .map((mesh) => valueOf(mesh?.DescriptorName))
    .filter(Boolean)
    .slice(0, 12);
}

function parseKeywords(keywordList) {
  const groups = normalizeArray(keywordList);
  return groups.flatMap((group) => normalizeArray(group?.Keyword).map(valueOf)).filter(Boolean);
}

function parsePubDate(pubDate) {
  if (!pubDate) return '';
  const year = pubDate.Year ?? '';
  const month = pubDate.Month ?? '';
  const day = pubDate.Day ?? '';
  if (year || month || day) return [year, month, day].filter(Boolean).join('-');
  return pubDate.MedlineDate ?? '';
}

function findArticleId(articleIds, type) {
  const match = articleIds.find((id) => id?.$?.IdType === type);
  return String(valueOf(match));
}

function normalizeArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function valueOf(value) {
  if (!value) return '';
  return value?._ ?? value;
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

