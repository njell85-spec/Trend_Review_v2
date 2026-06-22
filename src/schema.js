import { z } from 'zod';

export const PicoSchema = z.object({
  population: z.string().min(1),
  intervention: z.string().min(1),
  comparison: z.string().min(1),
  outcome: z.string().min(1),
});

export const AnalysisSchema = z.object({
  pmid: z.string().min(1),
  title: z.string().min(1),
  oneLineSummary_ko: z.string().min(1),
  clinicalQuestion: z.string().min(1),
  clinicalQuestion_ko: z.string().min(1),
  pico: PicoSchema,
  pico_ko: PicoSchema,
  keyFindings: z.array(z.string().min(1)).min(1).max(3),
  keyFindings_ko: z.array(z.string().min(1)).min(1).max(3),
  clinicalTakeaway: z.string().min(1),
  clinicalTakeaway_ko: z.string().min(1),
  limitations: z.string().min(1),
  limitations_ko: z.string().min(1),
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
    oneLineSummary_ko: { type: 'string' },
    clinicalQuestion: { type: 'string' },
    clinicalQuestion_ko: { type: 'string' },
    pico: picoJsonSchema(),
    pico_ko: picoJsonSchema(),
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
    clinicalTakeaway: { type: 'string' },
    clinicalTakeaway_ko: { type: 'string' },
    limitations: { type: 'string' },
    limitations_ko: { type: 'string' },
    evidenceLevel: { type: 'string', enum: ['High', 'Moderate', 'Low', 'Very Low'] },
    clinicalApplicabilityScore: { type: 'number', minimum: 0, maximum: 10 },
    manualReviewNeeded: { type: 'boolean' },
    analysisNotes: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'pmid',
    'title',
    'oneLineSummary_ko',
    'clinicalQuestion',
    'clinicalQuestion_ko',
    'pico',
    'pico_ko',
    'keyFindings',
    'keyFindings_ko',
    'clinicalTakeaway',
    'clinicalTakeaway_ko',
    'limitations',
    'limitations_ko',
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
