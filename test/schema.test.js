import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalysisSchema } from '../src/schema.js';
import { fallbackAnalysis } from '../src/analyze.js';

test('fallback analysis passes the runtime schema', () => {
  const paper = {
    pmid: '1',
    title: 'Test trial',
    abstract: 'Methods: We randomized 100 patients. Results: Mortality was lower in the intervention group.',
    screeningData: {
      score: 7,
      studyType: 'Randomized Controlled Trial',
    },
  };

  const fallback = fallbackAnalysis(paper, 'unit test');
  const parsed = AnalysisSchema.parse(fallback);
  assert.equal(parsed.pmid, '1');
  assert.equal(parsed.manualReviewNeeded, true);
});

test('schema rejects string PICO payloads', () => {
  assert.throws(() => {
    AnalysisSchema.parse({
      pmid: '1',
      title: 'Bad payload',
      oneLineSummary_ko: '요약',
      clinicalQuestion: 'Question',
      clinicalQuestion_ko: '질문',
      pico: 'not an object',
      pico_ko: {
        population: 'p',
        intervention: 'i',
        comparison: 'c',
        outcome: 'o',
      },
      keyFindings: ['finding'],
      keyFindings_ko: ['결과'],
      clinicalTakeaway: 'Takeaway',
      clinicalTakeaway_ko: '해석',
      limitations: 'Limit',
      limitations_ko: '제한점',
      evidenceLevel: 'Low',
      clinicalApplicabilityScore: 4,
      manualReviewNeeded: false,
      analysisNotes: [],
    });
  });
});

