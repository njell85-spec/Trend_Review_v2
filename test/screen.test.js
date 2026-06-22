import test from 'node:test';
import assert from 'node:assert/strict';
import { screenPapers } from '../src/screen.js';

const config = {
  topics: {
    search: { candidateLimit: 10 },
    screening: {
      relevanceKeywords: ['sepsis', 'critical care'],
      excludeKeywords: ['veterinary'],
      excludePublicationTypes: ['Case Reports'],
      highValueStudyTypes: ['Randomized Controlled Trial'],
      journalBoosts: { JAMA: 4 },
    },
  },
};

test('screening excludes case reports and ranks high-value studies', () => {
  const papers = [
    {
      pmid: '1',
      title: 'Sepsis randomized trial',
      abstract: 'We randomized 1200 patients with sepsis in critical care.',
      journal: 'JAMA',
      publicationTypes: ['Randomized Controlled Trial'],
      meshTerms: ['Sepsis'],
      keywords: [],
    },
    {
      pmid: '2',
      title: 'Rare case',
      abstract: 'One case.',
      journal: 'Case Reports',
      publicationTypes: ['Case Reports'],
      meshTerms: [],
      keywords: [],
    },
  ];

  const result = screenPapers({ papers, seenPmids: [], config });
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].pmid, '1');
  assert.equal(result.excluded.length, 1);
});

