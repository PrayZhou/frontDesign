import test from 'node:test';
import assert from 'node:assert/strict';
import { validateComponentPlan } from './plan-validator.mjs';

const validEmotion = {
  source: 'inferred',
  goal: 'warm curiosity strong enough to place a first order',
  rationale: 'A first-time visitor needs to believe the shop is real.',
  carriers: { visual: 'One real craft photograph' },
  avoid: ['Template gradients'],
  qaQuestions: ['Does the first viewport establish one focal point?'],
};

function basePlan(emotionalIntent) {
  return {
    version: 1,
    designIntent: {
      product: 'Bakery homepage',
      audience: 'First-time visitors',
      coreTask: 'Decide whether to order',
      visualDirection: 'Warm editorial',
      density: 'comfortable',
      principles: ['Let product imagery lead'],
      emotionalIntent,
    },
    foundation: 'shadcn',
    enhancer: null,
    dependencies: [],
    regions: [
      {
        id: 'hero',
        need: 'Understand the difference',
        capabilities: ['marketing'],
        selection: { source: 'foundation', component: 'card' },
        reason: 'Reuse the foundation card',
        states: ['default'],
        responsive: 'Single column on mobile',
        accessibility: { semantics: 'labelled region' },
      },
    ],
  };
}

test('a valid inferred feeling has no errors or warnings', () => {
  const result = validateComponentPlan(basePlan(validEmotion));
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.warnings.length, 0, JSON.stringify(result.warnings));
});

test('an unknown emotional source is an error', () => {
  const result = validateComponentPlan(basePlan({ ...validEmotion, source: 'guessed' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === 'invalid-emotional-source'));
});

test('a user-stated feeling without the user phrase warns', () => {
  const result = validateComponentPlan(basePlan({ ...validEmotion, source: 'user-provided' }));
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((item) => item.code === 'emotional-user-phrase-missing'));
});

test('a user-stated feeling with the user phrase is clean', () => {
  const result = validateComponentPlan(basePlan({
    ...validEmotion,
    source: 'user-provided',
    userPhrase: '想要温暖治愈的感觉',
  }));
  assert.equal(result.valid, true);
  assert.equal(result.warnings.length, 0, JSON.stringify(result.warnings));
});

test('a user phrase without a source warns instead of demoting to soft', () => {
  const { source, ...withoutSource } = validEmotion;
  const result = validateComponentPlan(basePlan({
    ...withoutSource,
    userPhrase: '想要温暖治愈的感觉',
  }));
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some((item) => item.code === 'emotional-user-phrase-unmarked'), JSON.stringify(result.warnings));
});

test('a user phrase marked inferred warns instead of demoting to soft', () => {
  const result = validateComponentPlan(basePlan({
    ...validEmotion,
    source: 'inferred',
    userPhrase: '想要温暖治愈的感觉',
  }));
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some((item) => item.code === 'emotional-user-phrase-unmarked'), JSON.stringify(result.warnings));
});
