import { z } from 'zod';

export const PicoSchema = z.object({
  population: z.string().min(1),
  intervention: z.string().min(1),
  comparison: z.string().min(1),
  outcome: z.string().min(1),
});

export const OutcomeSchema = z.object({
  label: z.string().min(1),
  outcome: z.string().min(1),
  outcome_ko: z.string().min(1),
  result: z.string().min(1),
  result_ko: z.string().min(1),
  statistics: z.string().min(1),
  interpretation: z.string().min(1),
  interpretation_ko: z.string().min(1),
});

export const DetailedPicoSchema = z.object({
  population: z.string().min(1),
  population_ko: z.string().min(1),
  countrySetting: z.string().min(1),
  countrySetting_ko: z.string().min(1),
  intervention: z.string().min(1),
  intervention_ko: z.string().min(1),
  comparator: z.string().min(1),
  comparator_ko: z.string().min(1),
  outcomes: z.array(OutcomeSchema).min(1).max(6),
});

export const AnalysisSchema = z.object({
  pmid: z.string().min(1),
  title: z.string().min(1),
  oneLineSummary: z.string().min(1),
  oneLineSummary_ko: z.string().min(1),
  whyItMatters: z.string().min(1),
  whyItMatters_ko: z.string().min(1),
  clinicalQuestion: z.string().min(1),
  clinicalQuestion_ko: z.string().min(1),
  pico: PicoSchema,
  pico_ko: PicoSchema,
  detailedPico: DetailedPicoSchema,
  keyFindings: z.array(z.string().min(1)).min(1).max(3),
  keyFindings_ko: z.array(z.string().min(1)).min(1).max(3),
  conclusion: z.string().min(1),
  conclusion_ko: z.string().min(1),
  clinicalTakeaway: z.string().min(1),
  clinicalTakeaway_ko: z.string().min(1),
  limitations: z.string().min(1),
  limitations_ko: z.string().min(1),
  edIcuApplicability: z.string().min(1),
  edIcuApplicability_ko: z.string().min(1),
  evidenceLevel: z.enum(['High', 'Moderate', 'Low', 'Very Low']),
  clinicalApplicabilityScore: z.number().min(0).max(10),
  manualReviewNeeded: z.boolean().default(false),
  analysisNotes: z.array(z.string()).default([]),
});

export const RankingItemSchema = z.object({
  pmid: z.string().min(1),
  rank: z.number().int().min(1),
  clinicalPriorityScore: z.number().min(0).max(10),
  rationale_ko: z.string().min(1),
});

export const RankingSchema = z.object({
  selected: z.array(RankingItemSchema).min(1).max(10),
  notes_ko: z.array(z.string()).default([]),
});

export const AnalysisJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pmid: { type: 'string' },
    title: { type: 'string' },
    oneLineSummary: { type: 'string' },
    oneLineSummary_ko: { type: 'string' },
    whyItMatters: { type: 'string' },
    whyItMatters_ko: { type: 'string' },
    clinicalQuestion: { type: 'string' },
    clinicalQuestion_ko: { type: 'string' },
    pico: picoJsonSchema(),
    pico_ko: picoJsonSchema(),
    detailedPico: detailedPicoJsonSchema(),
    keyFindings: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: { type: 'string' },
    },
    keyFindings_ko: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: { type: 'string' },
    },
    conclusion: { type: 'string' },
    conclusion_ko: { type: 'string' },
    clinicalTakeaway: { type: 'string' },
    clinicalTakeaway_ko: { type: 'string' },
    limitations: { type: 'string' },
    limitations_ko: { type: 'string' },
    edIcuApplicability: { type: 'string' },
    edIcuApplicability_ko: { type: 'string' },
    evidenceLevel: { type: 'string', enum: ['High', 'Moderate', 'Low', 'Very Low'] },
    clinicalApplicabilityScore: { type: 'number', minimum: 0, maximum: 10 },
    manualReviewNeeded: { type: 'boolean' },
    analysisNotes: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'pmid',
    'title',
    'oneLineSummary',
    'oneLineSummary_ko',
    'whyItMatters',
    'whyItMatters_ko',
    'clinicalQuestion',
    'clinicalQuestion_ko',
    'pico',
    'pico_ko',
    'detailedPico',
    'keyFindings',
    'keyFindings_ko',
    'conclusion',
    'conclusion_ko',
    'clinicalTakeaway',
    'clinicalTakeaway_ko',
    'limitations',
    'limitations_ko',
    'edIcuApplicability',
    'edIcuApplicability_ko',
    'evidenceLevel',
    'clinicalApplicabilityScore',
    'manualReviewNeeded',
    'analysisNotes',
  ],
};

export const RankingJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    selected: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          pmid: { type: 'string' },
          rank: { type: 'integer', minimum: 1 },
          clinicalPriorityScore: { type: 'number', minimum: 0, maximum: 10 },
          rationale_ko: { type: 'string' },
        },
        required: ['pmid', 'rank', 'clinicalPriorityScore', 'rationale_ko'],
      },
    },
    notes_ko: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['selected', 'notes_ko'],
};

function picoJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      population: { type: 'string' },
      intervention: { type: 'string' },
      comparison: { type: 'string' },
      outcome: { type: 'string' },
    },
    required: ['population', 'intervention', 'comparison', 'outcome'],
  };
}

function detailedPicoJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      population: { type: 'string' },
      population_ko: { type: 'string' },
      countrySetting: { type: 'string' },
      countrySetting_ko: { type: 'string' },
      intervention: { type: 'string' },
      intervention_ko: { type: 'string' },
      comparator: { type: 'string' },
      comparator_ko: { type: 'string' },
      outcomes: {
        type: 'array',
        minItems: 1,
        maxItems: 6,
        items: outcomeJsonSchema(),
      },
    },
    required: [
      'population',
      'population_ko',
      'countrySetting',
      'countrySetting_ko',
      'intervention',
      'intervention_ko',
      'comparator',
      'comparator_ko',
      'outcomes',
    ],
  };
}

function outcomeJsonSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      label: { type: 'string' },
      outcome: { type: 'string' },
      outcome_ko: { type: 'string' },
      result: { type: 'string' },
      result_ko: { type: 'string' },
      statistics: { type: 'string' },
      interpretation: { type: 'string' },
      interpretation_ko: { type: 'string' },
    },
    required: [
      'label',
      'outcome',
      'outcome_ko',
      'result',
      'result_ko',
      'statistics',
      'interpretation',
      'interpretation_ko',
    ],
  };
}
