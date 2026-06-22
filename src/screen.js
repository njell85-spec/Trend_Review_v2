const DEFAULT_STUDY_TYPE = 'Other';

export function screenPapers({ papers, seenPmids = [], config, options = {} }) {
  const search = config.topics.search ?? {};
  const screening = config.topics.screening ?? {};
  const seen = new Set(options.ignoreSeen ? [] : seenPmids.map(String));
  const candidateLimit = Number(options.candidateLimit ?? search.candidateLimit ?? 30);
  const scored = papers.map((paper) => scorePaper(paper, screening));

  const excluded = [];
  const candidates = [];

  for (const paper of scored) {
    if (seen.has(String(paper.pmid))) {
      excluded.push({ ...paper, exclusionReason: 'already seen' });
      continue;
    }
    if (paper.screeningData.exclude) {
      excluded.push({ ...paper, exclusionReason: paper.screeningData.excludeReason });
      continue;
    }
    candidates.push(paper);
  }

  const sorted = candidates.sort((a, b) => {
    const scoreDelta = b.screeningData.score - a.screeningData.score;
    if (scoreDelta !== 0) return scoreDelta;
    return String(b.pubDate ?? '').localeCompare(String(a.pubDate ?? ''));
  });

  return {
    candidates: sorted.slice(0, candidateLimit),
    allScreened: sorted,
    excluded,
    stats: {
      input: papers.length,
      seenSkipped: scored.filter((paper) => seen.has(String(paper.pmid))).length,
      excluded: excluded.length,
      candidates: sorted.length,
      candidateLimit,
    },
  };
}

export function scorePaper(paper, screening) {
  const haystack = [
    paper.title,
    paper.abstract,
    paper.journal,
    ...(paper.meshTerms ?? []),
    ...(paper.keywords ?? []),
  ]
    .join(' ')
    .toLowerCase();

  const publicationTypes = paper.publicationTypes ?? [];
  const excludeTypes = screening.excludePublicationTypes ?? [];
  const excludeKeywords = screening.excludeKeywords ?? [];
  const matchedExcludeType = publicationTypes.find((type) => includesAny(type, excludeTypes));
  const matchedExcludeKeyword = excludeKeywords.find((keyword) => haystack.includes(keyword.toLowerCase()));

  const relevanceMatches = (screening.relevanceKeywords ?? []).filter((keyword) =>
    haystack.includes(keyword.toLowerCase())
  );
  const studyType = inferStudyType(paper, screening.highValueStudyTypes ?? []);
  const sampleSize = extractSampleSize(paper.abstract);
  const journalBoost = journalScore(paper.journal, screening.journalBoosts ?? {});

  let score = 0;
  const reasons = [];

  if (paper.abstract?.length > 80) {
    score += 2;
    reasons.push('abstract available');
  }
  if (relevanceMatches.length) {
    score += Math.min(5, relevanceMatches.length);
    reasons.push(`topic match: ${relevanceMatches.slice(0, 4).join(', ')}`);
  }
  if (studyType !== DEFAULT_STUDY_TYPE) {
    score += studyTypeScore(studyType);
    reasons.push(`study design: ${studyType}`);
  }
  if (sampleSize) {
    const sampleScore = sampleSize >= 1000 ? 3 : sampleSize >= 300 ? 2 : 1;
    score += sampleScore;
    reasons.push(`sample size signal: N=${sampleSize}`);
  }
  if (journalBoost) {
    score += journalBoost;
    reasons.push(`journal boost: ${paper.journal}`);
  }

  const exclude = Boolean(matchedExcludeType || matchedExcludeKeyword || !paper.abstract);
  const excludeReason = matchedExcludeType
    ? `publication type excluded: ${matchedExcludeType}`
    : matchedExcludeKeyword
      ? `keyword excluded: ${matchedExcludeKeyword}`
      : !paper.abstract
        ? 'missing abstract'
        : '';

  return {
    ...paper,
    screeningData: {
      score,
      relevanceMatches,
      studyType,
      sampleSize,
      journalBoost,
      reasons,
      exclude,
      excludeReason,
    },
  };
}

function includesAny(value, list) {
  const lower = String(value ?? '').toLowerCase();
  return list.some((item) => lower.includes(String(item).toLowerCase()));
}

function inferStudyType(paper, highValueTypes) {
  const publicationText = (paper.publicationTypes ?? []).join(' ');
  const combined = `${publicationText} ${paper.title} ${paper.abstract}`.toLowerCase();

  const mapping = [
    ['Practice Guideline', ['practice guideline', 'guideline']],
    ['Meta-Analysis', ['meta-analysis', 'meta analysis']],
    ['Systematic Review', ['systematic review']],
    ['Randomized Controlled Trial', ['randomized', 'randomised', 'randomized controlled trial']],
    ['Clinical Trial', ['clinical trial', 'pragmatic trial']],
    ['Observational', ['cohort', 'case-control', 'cross-sectional', 'registry']],
  ];

  for (const [label, needles] of mapping) {
    if (needles.some((needle) => combined.includes(needle))) return label;
  }

  const highValueMatch = highValueTypes.find((type) => publicationText.toLowerCase().includes(type.toLowerCase()));
  return highValueMatch ?? DEFAULT_STUDY_TYPE;
}

function studyTypeScore(studyType) {
  if (studyType === 'Practice Guideline') return 4;
  if (studyType === 'Meta-Analysis' || studyType === 'Systematic Review') return 4;
  if (studyType === 'Randomized Controlled Trial') return 4;
  if (studyType === 'Clinical Trial') return 3;
  if (studyType === 'Observational') return 2;
  return 0;
}

function extractSampleSize(text = '') {
  const patterns = [
    /\b(?:n|N)\s*[=:]\s*([\d,]+)/,
    /\b([\d,]+)\s+(?:adult|adults|patient|patients|participant|participants|encounter|encounters|intubation|intubations)\b/i,
    /\bincluding\s+([\d,]+)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1].replace(/,/g, ''));
  }
  return null;
}

function journalScore(journal = '', boosts) {
  const lower = journal.toLowerCase();
  for (const [name, score] of Object.entries(boosts)) {
    if (lower === name.toLowerCase() || lower.includes(name.toLowerCase())) return Number(score);
  }
  return 0;
}
