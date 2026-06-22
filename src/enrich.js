import { parseStringPromise } from 'xml2js';
import { fetchWithRetry } from './utils/http.js';

const PMC_EFETCH = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';
const CLINICAL_TRIALS_API = 'https://clinicaltrials.gov/api/v2/studies';
const CROSSREF_WORKS = 'https://api.crossref.org/works';

export async function enrichPaperContext({ paper, config, options = {} }) {
  if (options.dryRun || options.skipFullText) return paper;

  const email = process.env.PUBMED_EMAIL || config.topics.search?.pubmed?.email || 'research@example.com';
  const maxFullTextChars = Number(config.topics.analysis?.maxFullTextChars ?? 16000);
  const maxWebContextChars = Number(config.topics.analysis?.maxWebContextChars ?? 12000);
  const sources = [];
  const contextBlocks = [];
  let fullText = '';
  let fullTextError = '';
  const nctIds = extractNctIds([...(paper.nctIds ?? []), paper.abstract, paper.title].join(' '));

  const pubmedContext = buildPubmedContext({ ...paper, nctIds });
  if (pubmedContext) {
    contextBlocks.push(pubmedContext);
    sources.push({ type: 'pubmed-metadata', label: 'PubMed metadata' });
  }

  const pmcid = normalizePmcid(paper.pmcid);
  if (pmcid) {
    try {
      fullText = await fetchPmcFullText({ pmcid, email, maxChars: maxFullTextChars });
      if (fullText) {
        sources.push({ type: 'pmc', label: `PMC full text ${pmcid}` });
      } else {
        fullTextError = 'PMC full text was empty or could not be extracted';
      }
    } catch (error) {
      fullTextError = error.message;
    }
  } else {
    fullTextError = 'No PMCID available for open full-text fetch';
  }

  for (const nctId of nctIds.slice(0, 3)) {
    const trialSummary = await safeFetchClinicalTrialSummary(nctId);
    if (trialSummary) {
      contextBlocks.push(trialSummary.text);
      sources.push({ type: 'clinicaltrials', label: `ClinicalTrials.gov ${nctId}` });
    }
  }

  const crossrefSummary = await safeFetchCrossrefSummary({ doi: paper.doi, title: paper.title, email });
  if (crossrefSummary) {
    contextBlocks.push(crossrefSummary.text);
    sources.push(crossrefSummary.source);
  }

  const landingSummary = await safeFetchLandingPageSummary({ doi: paper.doi, email });
  if (landingSummary) {
    contextBlocks.push(landingSummary.text);
    sources.push(landingSummary.source);
  }

  const enrichmentContext = contextBlocks
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .slice(0, maxWebContextChars);

  return {
    ...paper,
    nctIds,
    fullText,
    enrichmentContext,
    enrichmentSources: sources,
    contextSource: buildContextSource({ fullText, pmcid, fullTextError, sources }),
  };
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

function buildPubmedContext(paper) {
  const lines = [
    'Public metadata from PubMed:',
    `PMID: ${paper.pmid}`,
    `DOI: ${paper.doi || 'not reported'}`,
    `Clinical trial IDs found in PubMed record/abstract: ${(paper.nctIds ?? []).join(', ') || 'none'}`,
  ];

  if (paper.authorAffiliations?.length) {
    lines.push('Author affiliations:');
    for (const affiliation of paper.authorAffiliations.slice(0, 8)) {
      lines.push(`- ${affiliation}`);
    }
  }

  return lines.join('\n');
}

async function safeFetchClinicalTrialSummary(nctId) {
  try {
    const response = await fetchWithRetry(`${CLINICAL_TRIALS_API}/${encodeURIComponent(nctId)}`, {}, {
      attempts: 2,
      baseDelayMs: 500,
    });
    const study = await response.json();
    return { text: formatClinicalTrial(study, nctId) };
  } catch {
    return null;
  }
}

function formatClinicalTrial(study, fallbackNctId) {
  const protocol = study?.protocolSection ?? {};
  const identification = protocol.identificationModule ?? {};
  const status = protocol.statusModule ?? {};
  const design = protocol.designModule ?? {};
  const arms = protocol.armsInterventionsModule ?? {};
  const outcomes = protocol.outcomesModule ?? {};
  const eligibility = protocol.eligibilityModule ?? {};
  const locations = normalizeArray(protocol.contactsLocationsModule?.locations);
  const countries = unique(locations.map((location) => location.country).filter(Boolean));
  const sampleLocations = locations
    .map((location) => [location.facility, location.city, location.state, location.country].filter(Boolean).join(', '))
    .filter(Boolean)
    .slice(0, 12);

  const lines = [
    `Public trial registry from ClinicalTrials.gov (${identification.nctId ?? fallbackNctId}):`,
    `Brief title: ${identification.briefTitle ?? 'not reported'}`,
    `Official title: ${identification.officialTitle ?? 'not reported'}`,
    `Overall status: ${status.overallStatus ?? 'not reported'}`,
    `Study type / phase: ${[design.studyType, ...(design.phases ?? [])].filter(Boolean).join(', ') || 'not reported'}`,
    `Design: ${formatDesign(design.designInfo)}`,
    `Enrollment: ${formatEnrollment(design.enrollmentInfo)}`,
    `Countries: ${countries.join(', ') || 'not reported'}`,
  ];

  if (sampleLocations.length) {
    lines.push('Sample recruiting/participating locations:');
    for (const location of sampleLocations) lines.push(`- ${location}`);
  }

  const armGroups = normalizeArray(arms.armGroups);
  if (armGroups.length) {
    lines.push('Arms/groups:');
    for (const arm of armGroups.slice(0, 8)) {
      lines.push(`- ${arm.label}${arm.type ? ` (${arm.type})` : ''}: ${cleanText(arm.description).slice(0, 500)}`);
    }
  }

  const interventions = normalizeArray(arms.interventions);
  if (interventions.length) {
    lines.push('Interventions:');
    for (const intervention of interventions.slice(0, 10)) {
      lines.push(`- ${intervention.name}${intervention.type ? ` (${intervention.type})` : ''}: ${cleanText(intervention.description).slice(0, 500)}`);
    }
  }

  appendOutcomes(lines, 'Primary outcomes', outcomes.primaryOutcomes);
  appendOutcomes(lines, 'Secondary outcomes', outcomes.secondaryOutcomes);

  const criteria = cleanText(eligibility.eligibilityCriteria);
  if (criteria) {
    lines.push(`Eligibility excerpt: ${criteria.slice(0, 2800)}`);
  }

  return lines.join('\n');
}

function formatDesign(designInfo = {}) {
  return [
    designInfo.allocation,
    designInfo.interventionModel,
    designInfo.primaryPurpose,
    designInfo.maskingInfo?.masking ? `masking ${designInfo.maskingInfo.masking}` : '',
  ].filter(Boolean).join(', ') || 'not reported';
}

function formatEnrollment(enrollmentInfo = {}) {
  if (!enrollmentInfo.count) return 'not reported';
  return `${enrollmentInfo.count}${enrollmentInfo.type ? ` (${enrollmentInfo.type})` : ''}`;
}

function appendOutcomes(lines, label, values) {
  const outcomes = normalizeArray(values);
  if (!outcomes.length) return;
  lines.push(`${label}:`);
  for (const outcome of outcomes.slice(0, 8)) {
    const pieces = [
      outcome.measure,
      outcome.timeFrame ? `time frame: ${outcome.timeFrame}` : '',
      outcome.description,
    ].filter(Boolean);
    lines.push(`- ${cleanText(pieces.join(' | ')).slice(0, 600)}`);
  }
}

async function safeFetchCrossrefSummary({ doi, title, email }) {
  try {
    const url = doi
      ? `${CROSSREF_WORKS}/${encodeURIComponent(doi)}`
      : `${CROSSREF_WORKS}?${new URLSearchParams({ 'query.title': title, rows: '1' })}`;
    const response = await fetchWithRetry(url, {
      headers: {
        'User-Agent': `TrendReviewV2/0.1 (mailto:${email})`,
      },
    }, { attempts: 2, baseDelayMs: 500 });
    const data = await response.json();
    const work = doi ? data?.message : data?.message?.items?.[0];
    if (!work) return null;

    const lines = [
      'Public bibliographic metadata from Crossref:',
      `Title: ${cleanText(normalizeArray(work.title)[0]) || 'not reported'}`,
      `Type: ${work.type ?? 'not reported'}`,
      `Published: ${formatDateParts(work.published?.['date-parts']?.[0])}`,
      `Publisher: ${work.publisher ?? 'not reported'}`,
    ];

    const funders = normalizeArray(work.funder).map((funder) => funder.name).filter(Boolean);
    if (funders.length) lines.push(`Funders: ${unique(funders).slice(0, 8).join(', ')}`);
    if (work.abstract) lines.push(`Crossref abstract/snippet: ${cleanText(stripTags(work.abstract)).slice(0, 1800)}`);

    return {
      text: lines.join('\n'),
      source: { type: 'crossref', label: 'Crossref metadata' },
    };
  } catch {
    return null;
  }
}

async function safeFetchLandingPageSummary({ doi, email }) {
  if (!doi) return null;

  try {
    const response = await fetchWithRetry(`https://doi.org/${encodeURIComponent(doi)}`, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': `TrendReviewV2/0.1 (mailto:${email})`,
      },
    }, { attempts: 2, baseDelayMs: 500 });
    const html = await response.text();
    const metadata = extractHtmlMetadata(html);
    if (!metadata.length) return null;

    const preferred = [
      'citation_title',
      'citation_journal_title',
      'citation_publication_date',
      'citation_doi',
      'citation_clinical_trial_number',
      'citation_author_institution',
      'description',
      'og:description',
      'dc.description',
    ];
    const selected = metadata
      .filter((item) => preferred.includes(item.name.toLowerCase()))
      .slice(0, 18);
    if (!selected.length) return null;

    const lines = [
      `Public article landing-page metadata (${response.url}):`,
      ...selected.map((item) => `- ${item.name}: ${item.content}`),
    ];

    return {
      text: lines.join('\n'),
      source: { type: 'doi-landing', label: 'DOI landing metadata' },
    };
  } catch {
    return null;
  }
}

function buildContextSource({ fullText, pmcid, fullTextError, sources }) {
  const publicSources = sources.filter((source) => source.type !== 'pmc');
  if (fullText && publicSources.length) {
    return {
      type: 'pmc+metadata',
      pmcid,
      sources,
      fetchedAt: new Date().toISOString(),
    };
  }
  if (fullText) {
    return {
      type: 'pmc',
      pmcid,
      sources,
      fetchedAt: new Date().toISOString(),
    };
  }
  if (publicSources.length) {
    return {
      type: 'public-metadata',
      reason: fullTextError,
      sources,
      fetchedAt: new Date().toISOString(),
    };
  }
  return {
    type: 'abstract',
    reason: fullTextError || 'No public enrichment source available',
  };
}

function extractHtmlMetadata(html) {
  const values = [];
  const metaRegex = /<meta\s+[^>]*>/gi;
  const tags = String(html ?? '').match(metaRegex) ?? [];

  for (const tag of tags) {
    const name = readAttribute(tag, 'name') || readAttribute(tag, 'property');
    const content = readAttribute(tag, 'content');
    if (!name || !content) continue;
    values.push({
      name: decodeHtml(name).trim(),
      content: cleanText(decodeHtml(content)).slice(0, 800),
    });
  }

  return values;
}

function readAttribute(tag, attr) {
  const pattern = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i');
  const match = String(tag).match(pattern);
  return match?.[1] ?? '';
}

function normalizePmcid(value = '') {
  const text = String(value ?? '').trim();
  if (!text) return '';
  const match = text.match(/PMC\d+/i);
  return match ? match[0].toUpperCase() : '';
}

function extractNctIds(text = '') {
  return unique(String(text).match(/NCT\d{8}/gi) ?? []).map((id) => id.toUpperCase());
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

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function cleanText(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function stripTags(value = '') {
  return String(value).replace(/<[^>]+>/g, ' ');
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function formatDateParts(parts) {
  if (!Array.isArray(parts) || !parts.length) return 'not reported';
  return parts.filter(Boolean).join('-');
}
