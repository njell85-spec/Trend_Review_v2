import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalysisSchema, RankingSchema } from '../src/schema.js';
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

test('ranking schema accepts selected PMID priorities', () => {
  const parsed = RankingSchema.parse({
    selected: [
      {
        pmid: '123',
        rank: 1,
        clinicalPriorityScore: 8.5,
        rationale_ko: '응급/중환자 진료에 바로 참고할 수 있는 RCT입니다.',
      },
    ],
    notes_ko: ['주제 다양성을 고려했습니다.'],
  });

  assert.equal(parsed.selected[0].pmid, '123');
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
