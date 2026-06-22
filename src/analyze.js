import { AnalysisJsonSchema, AnalysisSchema, RankingJsonSchema, RankingSchema } from './schema.js';
import { enrichPaperContext } from './enrich.js';
import { fetchWithRetry } from './utils/http.js';

export async function analyzeTopPapers({ candidates, config, options }) {
  const topN = Number(options.topN ?? config.topics.search?.topN ?? 3);
  const provider = resolveProvider(options);
  const shouldUseLlm = provider !== 'none' && !options.skipLlm && !options.dryRun;
  const selection = await selectTopPapers({ candidates, topN, provider, shouldUseLlm });
  const topPapers = selection.topPapers;
  const analyses = [];
  const errors = selection.error ? [selection.error] : [];

  for (const paper of topPapers) {
    const result = await analyzeSinglePaper({ paper, config, options });
    analyses.push(result.analysis);
    if (result.error) errors.push(result.error);
  }

  return {
    analyses,
    stats: {
      requested: topN,
      analyzed: analyses.length,
      fallbackCount: analyses.filter((analysis) => analysis.manualReviewNeeded).length,
      selection: selection.stats,
    },
    errors,
  };
}

async function selectTopPapers({ candidates, topN, provider, shouldUseLlm }) {
  const deterministicTop = candidates.slice(0, topN);

  if (!shouldUseLlm || provider !== 'gemini' || candidates.length <= topN) {
    return {
      topPapers: deterministicTop,
      stats: {
        source: shouldUseLlm ? 'deterministic' : 'deterministic-fallback',
        provider,
        reason: !shouldUseLlm ? 'LLM selection disabled' : 'candidate pool does not need reranking',
      },
    };
  }

  try {
    const raw = await callGeminiRanking(buildRankingPrompt(candidates, topN));
    const ranking = RankingSchema.parse(raw);
    const byPmid = new Map(candidates.map((paper) => [String(paper.pmid), paper]));
    const selectedPmids = unique(ranking.selected.map((item) => String(item.pmid)));
    const selected = selectedPmids.map((pmid) => byPmid.get(pmid)).filter(Boolean);
    const selectedSet = new Set(selected.map((paper) => String(paper.pmid)));

    for (const paper of candidates) {
      if (selected.length >= topN) break;
      if (!selectedSet.has(String(paper.pmid))) selected.push(paper);
    }

    return {
      topPapers: selected.slice(0, topN),
      stats: {
        source: 'llm-rerank',
        provider,
        selected: ranking.selected,
        notes_ko: ranking.notes_ko,
      },
    };
  } catch (error) {
    return {
      topPapers: deterministicTop,
      stats: {
        source: 'deterministic-fallback',
        provider,
        reason: error.message,
      },
      error: {
        step: 'rank',
        message: error.message,
      },
    };
  }
}

export async function analyzeSinglePaper({ paper, config, options }) {
  const provider = resolveProvider(options);
  const shouldUseLlm = provider !== 'none' && !options.skipLlm && !options.dryRun;

  if (!shouldUseLlm) {
    return { analysis: fallbackAnalysis(paper, provider === 'none' ? 'LLM provider not configured' : 'dry-run fallback') };
  }

  const enrichedPaper = await enrichPaperContext({ paper, config, options });
  const maxChars = Number(config.topics.analysis?.maxAbstractChars ?? 4500);
  const maxFullTextChars = Number(config.topics.analysis?.maxFullTextChars ?? 16000);
  const maxWebContextChars = Number(config.topics.analysis?.maxWebContextChars ?? 12000);
  const prompt = buildPrompt(enrichedPaper, maxChars, maxFullTextChars, maxWebContextChars);
  const geminiSearchGrounding = resolveGeminiSearchGrounding(config, options);

  try {
    const raw = await callProvider({ provider, prompt, paper: enrichedPaper, geminiSearchGrounding });
    const analysis = validateAnalysis(raw, enrichedPaper);
    return { analysis };
  } catch (firstError) {
    if (!config.topics.analysis?.retryInvalidSchema) {
      return fallbackWithError(enrichedPaper, firstError);
    }

    try {
      const repairPrompt = `${prompt}\n\nYour previous response failed schema validation. Return only a valid JSON object that exactly matches the requested schema. Do not include markdown.`;
      const repaired = await callProvider({ provider, prompt: repairPrompt, paper: enrichedPaper, geminiSearchGrounding });
      const analysis = validateAnalysis(repaired, enrichedPaper);
      return { analysis };
    } catch (secondError) {
      return fallbackWithError(enrichedPaper, secondError);
    }
  }
}

function resolveProvider(options) {
  const explicit = options.llmProvider || process.env.LLM_PROVIDER;
  if (explicit) return explicit.toLowerCase();
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'none';
}

function resolveGeminiSearchGrounding(config, options) {
  if (typeof options.geminiSearchGrounding === 'boolean') return options.geminiSearchGrounding;
  if (process.env.GEMINI_SEARCH_GROUNDING) {
    return ['1', 'true', 'yes', 'on'].includes(process.env.GEMINI_SEARCH_GROUNDING.toLowerCase());
  }
  return Boolean(config.topics.analysis?.geminiSearchGrounding);
}

async function callProvider({ provider, prompt, paper, geminiSearchGrounding }) {
  if (provider === 'gemini') return callGeminiAnalysis(prompt, paper, { geminiSearchGrounding });
  if (provider === 'openai') return callOpenAi(prompt, paper);
  if (provider === 'anthropic') return callAnthropic(prompt, paper);
  throw new Error(`Unsupported LLM provider: ${provider}`);
}

async function callGeminiAnalysis(prompt, paper, { geminiSearchGrounding = false } = {}) {
  return callGeminiJson({
    prompt,
    schema: AnalysisJsonSchema,
    context: `analysis ${paper.pmid}`,
    geminiSearchGrounding,
  });
}

async function callGeminiRanking(prompt) {
  return callGeminiJson({
    prompt,
    schema: RankingJsonSchema,
    context: 'candidate ranking',
  });
}

async function callGeminiJson({ prompt, schema, context, geminiSearchGrounding = false }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing');

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `You are an emergency medicine and critical care physician. Return only validated JSON.\n\n${prompt}`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: geminiResponseSchema(schema),
    },
  };

  if (geminiSearchGrounding) {
    body.tools = [{ google_search: {} }];
  }

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  const content = data?.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join('\n');
  if (!content) throw new Error(`Gemini response did not include message content for ${context}`);
  const parsed = JSON.parse(content);
  const groundingMetadata = data?.candidates?.[0]?.groundingMetadata;
  if (groundingMetadata) parsed.__groundingMetadata = groundingMetadata;
  return parsed;
}

function geminiResponseSchema(schema) {
  if (Array.isArray(schema)) return schema.map(geminiResponseSchema);
  if (!schema || typeof schema !== 'object') return schema;

  const unsupportedKeys = new Set(['additionalProperties', '$schema']);
  return Object.fromEntries(
    Object.entries(schema)
      .filter(([key]) => !unsupportedKeys.has(key))
      .map(([key, value]) => [key, geminiResponseSchema(value)])
  );
}

async function callOpenAi(prompt, paper) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing');

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const response = await fetchWithRetry('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an emergency medicine and critical care physician. Return only validated JSON.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: `trend_review_pico_${paper.pmid}`,
          strict: true,
          schema: AnalysisJsonSchema,
        },
      },
    }),
  });

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI response did not include message content');
  return JSON.parse(content);
}

async function callAnthropic(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is missing');

  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';
  const response = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
      tools: [
        {
          name: 'submit_trend_review_analysis',
          description: 'Submit structured PICO analysis for one EM/CCM paper',
          input_schema: AnalysisJsonSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_trend_review_analysis' },
    }),
  });

  const data = await response.json();
  const toolUse = data?.content?.find((part) => part.type === 'tool_use');
  if (!toolUse?.input) throw new Error('Anthropic response did not include tool input');
  return toolUse.input;
}

function validateAnalysis(raw, paper) {
  const groundingSources = extractGroundingSources(raw.__groundingMetadata);
  const parsed = AnalysisSchema.parse({
    ...raw,
    pmid: String(raw.pmid || paper.pmid),
    title: String(raw.title || paper.title),
  });

  return {
    ...parsed,
    analysisNotes: groundingSources.length
      ? [...parsed.analysisNotes, `Gemini Google Search grounding sources: ${groundingSources.map((source) => source.title).join('; ')}`]
      : parsed.analysisNotes,
    paper: groundingSources.length ? { ...paper, geminiGroundingSources: groundingSources } : paper,
    source: 'llm',
  };
}

function extractGroundingSources(metadata) {
  const chunks = metadata?.groundingChunks ?? [];
  return chunks
    .map((chunk) => chunk.web)
    .filter((web) => web?.uri)
    .map((web) => ({
      title: String(web.title || web.uri).slice(0, 160),
      uri: web.uri,
    }))
    .slice(0, 8);
}

function buildPrompt(paper, maxChars, maxFullTextChars, maxWebContextChars) {
  const abstract = String(paper.abstract ?? '').slice(0, maxChars);
  const fullText = String(paper.fullText ?? '').slice(0, maxFullTextChars);
  const enrichmentContext = String(paper.enrichmentContext ?? '').slice(0, maxWebContextChars);
  const contextSource = formatContextSource(paper.contextSource);
  const sourceLabels = (paper.enrichmentSources ?? []).map((source) => source.label).join('; ') || 'none';
  const score = paper.screeningData?.score ?? 0;
  const studyType = paper.screeningData?.studyType ?? 'Other';

  return `Analyze this emergency medicine / critical care paper for a daily clinician newsletter.

Return a single JSON object matching the provided schema.

Rules:
- Do not invent statistics. Use only values explicitly stated in the abstract, open full text excerpt, or public enrichment context.
- Use public enrichment context from PubMed metadata, ClinicalTrials.gov, Crossref, and DOI landing pages to deepen country/setting, population, intervention/comparator details, outcomes, limitations, and applicability.
- When using trial-registry or landing-page metadata, phrase it as public registry/metadata information if it is not explicitly in the article abstract.
- Do not say country, setting, study arms, trial design, or outcomes are "not reported" if they appear in public enrichment context.
- If exact drug dose, route, baseline balance, subgroup data, exact values, or follow-up are absent from all provided sources, say they are not available in the accessible sources.
- If open full text is provided, use it to deepen PICO, outcomes, limitations, and applicability.
- Preserve important English study terms, drug names, endpoints, effect estimates, and statistical notation.
- For every English field, provide the Korean paired field when the schema asks for *_ko.
- detailedPico should be rich enough that a clinician can understand what was actually done without opening the paper.
- Put primary and secondary outcomes inside detailedPico.outcomes.
- Each outcome interpretation should be concise, intuitive, and avoid the phrase "easy interpretation".
- Explain p value, OR/RR/HR, CI, risk difference, mean difference, and NNT only when those statistics appear.
- Use p<0.05 as a common convention, but separate statistical significance from clinical importance.
- oneLineSummary and oneLineSummary_ko must each be one short sentence.
- clinicalApplicabilityScore should reflect direct usefulness for EM/CCM practice.

Paper:
PMID: ${paper.pmid}
Title: ${paper.title}
Journal: ${paper.journal} (${paper.pubDate})
Authors: ${(paper.authors ?? []).join(', ') || 'Not reported'}
Study type signal: ${studyType}
Deterministic screening score: ${score}
Analysis source: ${contextSource}
Public enrichment sources: ${sourceLabels}
Publication types: ${(paper.publicationTypes ?? []).join(', ') || 'Not reported'}
MeSH terms: ${(paper.meshTerms ?? []).join(', ') || 'Not reported'}
Keywords: ${(paper.keywords ?? []).join(', ') || 'Not reported'}

Abstract:
${abstract}

${enrichmentContext ? `Public enrichment context:\n${enrichmentContext}\n` : ''}

${fullText ? `Open full text excerpt:\n${fullText}` : ''}`;
}

function formatContextSource(contextSource = {}) {
  if (contextSource.type === 'pmc+metadata') return `Open full text from PMC (${contextSource.pmcid}) plus public metadata`;
  if (contextSource.type === 'pmc') return `Open full text from PMC (${contextSource.pmcid})`;
  if (contextSource.type === 'public-metadata') return `Abstract plus public metadata (${contextSource.reason ?? 'no PMC full text'})`;
  return `Abstract only (${contextSource.reason ?? 'no open full text attached'})`;
}

function buildRankingPrompt(candidates, topN) {
  const papers = candidates.map((paper, index) => formatCandidateForRanking(paper, index + 1)).join('\n\n');

  return `Select the Top ${topN} papers for a daily emergency medicine / critical care clinician newsletter.

Return a single JSON object matching the provided schema.

Selection criteria:
- Prioritize practice-changing or high-yield clinical relevance for EM/CCM clinicians.
- Prefer guidelines, randomized trials, systematic reviews, meta-analyses, high-impact journals, and large actionable observational studies.
- De-prioritize case reports, animal/preclinical work, narrow education/QI papers, and papers with weak direct patient-care relevance.
- Consider deterministic screening score, but override it when the abstract suggests low clinical usefulness.
- Keep topic diversity when papers are otherwise similar.
- Select only PMIDs from the candidate list.
- rationale_ko should briefly explain why the paper deserves or does not deserve priority.

Candidates:
${papers}`;
}

function formatCandidateForRanking(paper, index) {
  const screening = paper.screeningData ?? {};
  const abstract = String(paper.abstract ?? '').replace(/\s+/g, ' ').slice(0, 1200);

  return `${index}. PMID: ${paper.pmid}
Title: ${paper.title}
Journal: ${paper.journal} (${paper.pubDate})
Study type signal: ${screening.studyType ?? 'Other'}
Deterministic score: ${screening.score ?? 0}
Screening reasons: ${(screening.reasons ?? []).join('; ') || 'none'}
Publication types: ${(paper.publicationTypes ?? []).join(', ') || 'Not reported'}
Abstract: ${abstract}`;
}

function fallbackWithError(paper, error) {
  return {
    analysis: fallbackAnalysis(paper, error.message),
    error: {
      pmid: paper.pmid,
      step: 'analysis',
      message: error.message,
    },
  };
}

export function fallbackAnalysis(paper, reason = 'manual fallback') {
  const sentence = firstSentence(paper.abstract) || paper.title;
  const score = clampScore(paper.screeningData?.score ?? 3);
  const studyType = paper.screeningData?.studyType ?? 'Other';

  return {
    pmid: String(paper.pmid),
    title: paper.title,
    oneLineSummary: `Automated detailed analysis was not available; manual review is needed. ${sentence}`,
    oneLineSummary_ko: `자동 상세 분석을 사용할 수 없어 원문 또는 초록 확인이 필요합니다. ${sentence}`,
    whyItMatters: 'This paper matched the EM/CCM screening rules, but the automated analysis failed and should be reviewed manually before use.',
    whyItMatters_ko: '이 논문은 EM/CCM 스크리닝 기준에는 포함되었지만 자동 분석이 실패했으므로 실제 활용 전 수동 확인이 필요합니다.',
    clinicalQuestion: `What does this ${studyType.toLowerCase()} suggest for emergency medicine or critical care practice?`,
    clinicalQuestion_ko: '이 논문이 응급의학 또는 중환자의학 진료에 어떤 의미가 있는지 검토해야 합니다.',
    pico: {
      population: 'Manual review needed. Population details were not reliably extracted.',
      intervention: 'Manual review needed. Intervention or exposure details were not reliably extracted.',
      comparison: 'Manual review needed. Comparator details were not reliably extracted or not reported.',
      outcome: sentence,
    },
    pico_ko: {
      population: '수동 검토 필요. 대상 환자군을 안정적으로 추출하지 못했습니다.',
      intervention: '수동 검토 필요. 중재 또는 노출 정보를 안정적으로 추출하지 못했습니다.',
      comparison: '수동 검토 필요. 비교군 정보가 없거나 안정적으로 추출되지 않았습니다.',
      outcome: sentence,
    },
    detailedPico: {
      population: 'Manual review needed. Population details were not reliably extracted.',
      population_ko: '수동 검토 필요. 대상 환자군을 안정적으로 추출하지 못했습니다.',
      countrySetting: 'Not reliably extracted.',
      countrySetting_ko: '국가와 연구 세팅을 안정적으로 추출하지 못했습니다.',
      intervention: 'Manual review needed.',
      intervention_ko: '수동 검토가 필요합니다.',
      comparator: 'Manual review needed or not reported.',
      comparator_ko: '수동 검토가 필요하거나 보고되지 않았습니다.',
      outcomes: [
        {
          label: 'Outcome',
          outcome: 'Manual review needed.',
          outcome_ko: '수동 검토 필요.',
          result: sentence,
          result_ko: sentence,
          statistics: 'Not reliably extracted.',
          interpretation: 'Statistical interpretation was not available because structured analysis failed.',
          interpretation_ko: '구조화 분석 실패로 통계 해석을 제공하지 못했습니다.',
        },
      ],
    },
    keyFindings: [sentence],
    keyFindings_ko: [sentence],
    conclusion: 'Automated conclusion was not available.',
    conclusion_ko: '자동 결론을 생성하지 못했습니다.',
    clinicalTakeaway: 'Automated analysis was not available. Review the abstract and original paper before changing practice.',
    clinicalTakeaway_ko: '자동 분석을 사용할 수 없습니다. 진료 변경 전 초록과 원문을 직접 확인해야 합니다.',
    limitations: `Fallback summary generated because: ${reason}`,
    limitations_ko: `다음 이유로 fallback 요약을 생성했습니다: ${reason}`,
    edIcuApplicability: 'Manual review needed before applying this paper to ED or ICU practice.',
    edIcuApplicability_ko: 'ED/ICU 진료에 적용하기 전 수동 검토가 필요합니다.',
    evidenceLevel: fallbackEvidenceLevel(studyType),
    clinicalApplicabilityScore: score,
    manualReviewNeeded: true,
    analysisNotes: [reason],
    paper,
    source: 'fallback',
  };
}

function firstSentence(text = '') {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^(.{40,240}?[.!?])\s/);
  return match ? match[1] : trimmed.slice(0, 220);
}

function clampScore(value) {
  return Math.max(0, Math.min(10, Number(value) || 0));
}

function unique(values) {
  return [...new Set(values)];
}

function fallbackEvidenceLevel(studyType) {
  if (['Meta-Analysis', 'Systematic Review', 'Randomized Controlled Trial', 'Practice Guideline'].includes(studyType)) {
    return 'Moderate';
  }
  if (studyType === 'Clinical Trial' || studyType === 'Observational') return 'Low';
  return 'Very Low';
}
