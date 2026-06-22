import { AnalysisJsonSchema, AnalysisSchema } from './schema.js';
import { fetchWithRetry } from './utils/http.js';

export async function analyzeTopPapers({ candidates, config, options }) {
  const topN = Number(options.topN ?? config.topics.search?.topN ?? 3);
  const topPapers = candidates.slice(0, topN);
  const analyses = [];
  const errors = [];

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
    },
    errors,
  };
}

export async function analyzeSinglePaper({ paper, config, options }) {
  const provider = resolveProvider(options);
  const shouldUseLlm = provider !== 'none' && !options.skipLlm && !options.dryRun;

  if (!shouldUseLlm) {
    return { analysis: fallbackAnalysis(paper, provider === 'none' ? 'LLM provider not configured' : 'dry-run fallback') };
  }

  const maxChars = Number(config.topics.analysis?.maxAbstractChars ?? 4500);
  const prompt = buildPrompt(paper, maxChars);

  try {
    const raw = await callProvider({ provider, prompt, paper });
    const analysis = validateAnalysis(raw, paper);
    return { analysis };
  } catch (firstError) {
    if (!config.topics.analysis?.retryInvalidSchema) {
      return fallbackWithError(paper, firstError);
    }

    try {
      const repairPrompt = `${prompt}\n\nYour previous response failed schema validation. Return only a valid JSON object that exactly matches the requested schema. Do not include markdown.`;
      const repaired = await callProvider({ provider, prompt: repairPrompt, paper });
      const analysis = validateAnalysis(repaired, paper);
      return { analysis };
    } catch (secondError) {
      return fallbackWithError(paper, secondError);
    }
  }
}

function resolveProvider(options) {
  const explicit = options.llmProvider || process.env.LLM_PROVIDER;
  if (explicit) return explicit.toLowerCase();
  if (process.env.OPENAI_API_KEY) return 'openai';
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return 'none';
}

async function callProvider({ provider, prompt, paper }) {
  if (provider === 'openai') return callOpenAi(prompt, paper);
  if (provider === 'anthropic') return callAnthropic(prompt, paper);
  throw new Error(`Unsupported LLM provider: ${provider}`);
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
  const parsed = AnalysisSchema.parse({
    ...raw,
    pmid: String(raw.pmid || paper.pmid),
    title: String(raw.title || paper.title),
  });

  return {
    ...parsed,
    paper,
    source: 'llm',
  };
}

function buildPrompt(paper, maxChars) {
  const abstract = String(paper.abstract ?? '').slice(0, maxChars);
  const score = paper.screeningData?.score ?? 0;
  const studyType = paper.screeningData?.studyType ?? 'Other';

  return `Analyze this emergency medicine / critical care paper for a daily clinician newsletter.

Return a single JSON object matching the provided schema.

Rules:
- Do not invent statistics. Use only values explicitly stated in the title or abstract.
- If country, baseline balance, subgroup data, or exact values are not stated, say they are not reported.
- Keep English PICO close to the source wording.
- Provide Korean translations for all *_ko fields.
- Keep Korean concise and practical for a clinician reading on mobile.
- oneLineSummary_ko must be one short Korean sentence.
- clinicalApplicabilityScore should reflect direct usefulness for EM/CCM practice.

Paper:
PMID: ${paper.pmid}
Title: ${paper.title}
Journal: ${paper.journal} (${paper.pubDate})
Study type signal: ${studyType}
Deterministic screening score: ${score}
Publication types: ${(paper.publicationTypes ?? []).join(', ') || 'Not reported'}
MeSH terms: ${(paper.meshTerms ?? []).join(', ') || 'Not reported'}
Keywords: ${(paper.keywords ?? []).join(', ') || 'Not reported'}

Abstract:
${abstract}`;
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
    oneLineSummary_ko: `자동 상세 분석이 제한되어 원문 초록 확인이 필요합니다: ${sentence}`,
    clinicalQuestion: `What does this ${studyType.toLowerCase()} suggest for emergency medicine or critical care practice?`,
    clinicalQuestion_ko: `이 논문이 응급의학 또는 중환자의학 진료에 어떤 의미가 있는지 검토해야 합니다.`,
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
    keyFindings: [sentence],
    keyFindings_ko: [sentence],
    clinicalTakeaway: 'Automated analysis was not available. Review the abstract and original paper before changing practice.',
    clinicalTakeaway_ko: '자동 분석을 사용할 수 없습니다. 진료 변경 전 초록과 원문을 직접 확인해야 합니다.',
    limitations: `Fallback summary generated because: ${reason}`,
    limitations_ko: `다음 이유로 fallback 요약을 생성했습니다: ${reason}`,
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

function fallbackEvidenceLevel(studyType) {
  if (['Meta-Analysis', 'Systematic Review', 'Randomized Controlled Trial', 'Practice Guideline'].includes(studyType)) {
    return 'Moderate';
  }
  if (studyType === 'Clinical Trial' || studyType === 'Observational') return 'Low';
  return 'Very Low';
}

