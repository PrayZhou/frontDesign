import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPlan, TIER_SITES } from './inspiration-planner.mjs';

test('inspiration channel plans T2 and T3 by default', () => {
  const plan = searchPlan({ channel: 'inspiration', brief: 'operations dashboard for support teams' });
  assert.equal(plan.status, 'ok');
  assert.deepEqual(plan.tiers, ['T2', 'T3']);
  assert.ok(plan.targets.every((target) => target.tier !== 'T1'));
  assert.ok(plan.queries.length > 0);
  assert.ok(plan.queries.every((query) => ['T2', 'T3'].includes(query.tier)));
});

test('components channel plans T1 only and marks candidates', () => {
  const plan = searchPlan({ channel: 'components', brief: 'data table with filters' });
  assert.deepEqual(plan.tiers, ['T1']);
  assert.ok(plan.targets.length > 0);
  assert.ok(plan.targets.every((target) => target.tier === 'T1'));
  assert.ok(plan.queries.length > 0);
  assert.ok(plan.queries.every((query) => query.purpose === 'component-candidate'));
});

test('components plan states the no-install rule', () => {
  const plan = searchPlan({ channel: 'components', brief: 'data table' });
  assert.ok(plan.constraints.some((constraint) => constraint.includes('requires-command')));
});

test('planning is deterministic and ignores stopwords', () => {
  const first = searchPlan({ channel: 'inspiration', brief: 'a dashboard for the team' });
  const second = searchPlan({ channel: 'inspiration', brief: 'a dashboard for the team' });
  assert.deepEqual(first, second);
  assert.ok(first.queries.every((query) => !query.text.startsWith('the ')));
});

test('unknown channel and tier are rejected', () => {
  assert.throws(() => searchPlan({ channel: 'nope', brief: 'x' }), /Unknown channel/);
  assert.throws(() => searchPlan({ channel: 'inspiration', brief: 'x', tiers: 'T9' }), /Unknown tier/);
});

test('T3 targets carry the no-candidate prohibition', () => {
  const target = TIER_SITES.find((entry) => entry.tier === 'T3');
  assert.ok(target.forbidden.includes('component-candidate'));
});

import { normalizeCaptured } from './inspiration-planner.mjs';
import { validateComponentPlan } from './plan-validator.mjs';

const captured = {
  references: [
    {
      url: 'https://dribbble.com/shots/1',
      publisher: 'Dribbble',
      tier: 'T3',
      claim: 'Dashboard hierarchy leads with one dominant task above the fold.',
      confidence: 'medium',
      capturedAt: '2026-09-13',
      license: 'All rights reserved',
      appliesWhen: ['dashboard'],
    },
    {
      url: 'https://ui.shadcn.com/docs/components/data-table',
      publisher: 'shadcn',
      tier: 'T1',
      claim: 'Data table composes through a root and toolbar parts.',
      capturedAt: '2026-09-13',
    },
  ],
};

test('normalizeCaptured maps tiers to evidence records', () => {
  const records = normalizeCaptured(captured);
  assert.equal(records.length, 2);
  assert.equal(records[0].id, 'insp-001');
  assert.equal(records[0].type, 'observed-pattern');
  assert.equal(records[1].type, 'official-doc');
  assert.equal(records[1].confidence, 'medium');
  assert.match(records[0].notes, /do not copy/);
});

test('normalized records satisfy the plan validator', () => {
  const plan = {
    version: 1,
    designIntent: {
      product: 'Operations dashboard',
      audience: 'Support teams',
      coreTask: 'Review account health',
      visualDirection: 'Calm information-forward workspace',
      density: 'comfortable',
      principles: ['Make health scannable'],
      evidence: normalizeCaptured(captured),
    },
    foundation: 'shadcn',
    enhancer: null,
    dependencies: [],
    regions: [
      {
        id: 'summary',
        need: 'See account health',
        capabilities: ['data'],
        selection: { source: 'foundation', component: 'card' },
        reason: 'Reuse the foundation card',
        states: ['loading', 'empty', 'error', 'success'],
        responsive: 'Single column on mobile',
        accessibility: { semantics: 'labelled region' },
      },
    ],
  };
  const result = validateComponentPlan(plan);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('missing required reference fields are rejected', () => {
  assert.throws(() => normalizeCaptured({ references: [{ tier: 'T3' }] }), /url is required/);
  assert.throws(() => normalizeCaptured({ references: [] }), /non-empty array/);
  assert.throws(() => normalizeCaptured({ references: [{ url: 'u', publisher: 'p', claim: 'c', tier: 'T9' }] }), /must be one of T1, T2, T3/);
});

test('an unmatched T1 URL falls back to the tier allowed use', () => {
  const records = normalizeCaptured({
    references: [
      {
        url: 'https://example-t1.test/button',
        publisher: 'Example',
        tier: 'T1',
        claim: 'Buttons compose from a root and a label part.',
        capturedAt: '2026-09-13',
      },
    ],
  });
  assert.equal(records.length, 1);
  const constraints = records[0].constraints.join(' ');
  assert.match(constraints, /component-candidate/);
  assert.doesNotMatch(constraints, /transferable-principle/);
});

import { auditPlan } from './inspiration-planner.mjs';

const region = (source, component) => ({
  id: 'r', need: 'n', capabilities: ['data'],
  selection: { source, component },
  reason: 'x', states: ['success'], responsive: 'x', accessibility: {},
});

test('a clean plan has no violations', () => {
  const result = auditPlan({ regions: [region('foundation', 'card')] });
  assert.equal(result.valid, true);
  assert.deepEqual(result.violations, []);
});

test('a T3 source used as a candidate is a violation', () => {
  const result = auditPlan({ regions: [region('dribbble.com', 'hero-card')] });
  assert.equal(result.valid, false);
  assert.equal(result.violations[0].code, 'inspiration-source-as-candidate');
});

test('an explicit tier alias used as a candidate is a violation', () => {
  const result = auditPlan({ regions: [region('t2', 'hero-card'), region('T3', 'other')] });
  assert.equal(result.valid, false);
  assert.equal(result.violations.length, 2);
});

test('a T1 registry source is allowed', () => {
  const result = auditPlan({ regions: [region('ui.shadcn.com', 'data-table')] });
  assert.equal(result.valid, true);
});

test('audit flags bare brand labels and hosts for restricted sites', () => {
  const flagged = [
    'dribbble', 'Dribbble', 'dribbble.com', 'https://dribbble.com/shots/1',
    'figma', 'figma.com', 't2', 't3',
  ];
  for (const source of flagged) {
    const result = auditPlan({ regions: [region(source, 'hero-card')] });
    assert.equal(result.valid, false, `expected ${source} to be flagged`);
    assert.equal(result.violations.length, 1, `expected one violation for ${source}`);
    assert.equal(result.violations[0].code, 'inspiration-source-as-candidate');
  }
});

test('audit allows dotted non-host values and T1 sources', () => {
  const allowed = ['layers.total', 'shadcn', 'ui.shadcn.com', '21st.dev', 'foundation'];
  for (const source of allowed) {
    const result = auditPlan({ regions: [region(source, 'card')] });
    assert.equal(result.valid, true, `expected ${source} to be allowed`);
    assert.deepEqual(result.violations, []);
  }
});

test('a Chinese brief produces Chinese-suffixed queries', () => {
  const plan = searchPlan({ channel: 'inspiration', brief: '温暖治愈的手工面包首页' });
  assert.equal(plan.queries.length, 6);
  assert.equal(plan.queries[0].text, '温暖 真实产品界面');
  assert.equal(plan.queries[5].text, '治愈 设计灵感');
});

test('an English brief keeps its Latin tier suffixes', () => {
  const plan = searchPlan({ channel: 'inspiration', brief: 'operations dashboard for support teams' });
  assert.deepEqual(plan.queries.map((query) => query.text), [
    'operations real product ui', 'dashboard real product ui', 'support real product ui',
    'operations design inspiration', 'dashboard design inspiration', 'support design inspiration',
  ]);
});

const inferredIntent = (overrides = {}) => ({
  designIntent: {
    emotionalIntent: {
      goal: 'warm curiosity',
      rationale: 'First-time visitors need to trust the shop.',
      carriers: { visual: 'One real photograph' },
      avoid: ['Template gradients'],
      qaQuestions: ['Is there one focal point in the first viewport?'],
      ...overrides,
    },
  },
});

test('a stated feeling leads the plan without dropping the brief subject', () => {
  const plan = searchPlan({ channel: 'inspiration', brief: 'bakery homepage', emotion: '温暖治愈' });
  assert.equal(plan.emotion.source, 'user-provided');
  assert.equal(plan.emotion.binding, 'hard');
  assert.equal(plan.queries[0].text, '温暖治愈 真实产品界面');
  assert.ok(plan.queries.some((query) => query.text.startsWith('bakery ')));
  assert.ok(plan.constraints.some((constraint) => /binding/.test(constraint)));
});

test('a Latin stated feeling also seeds the queries', () => {
  const plan = searchPlan({ channel: 'inspiration', brief: 'bakery homepage', emotion: 'warm inviting' });
  assert.equal(plan.emotion.source, 'user-provided');
  assert.equal(plan.emotion.binding, 'hard');
  assert.equal(plan.queries[0].text, 'warm real product ui');
  assert.ok(plan.queries.some((query) => query.text.startsWith('bakery ')));
});

test('the emotion flag outranks the plan emotional intent', () => {
  const plan = searchPlan({
    channel: 'inspiration',
    brief: 'dashboard',
    emotion: '温暖治愈',
    intent: inferredIntent({ source: 'inferred' }),
  });
  assert.equal(plan.emotion.text, '温暖治愈');
  assert.equal(plan.emotion.source, 'user-provided');
  assert.equal(plan.emotion.binding, 'hard');
});

test('an inferred feeling stays soft with no binding constraint', () => {
  const plan = searchPlan({ channel: 'inspiration', brief: 'bakery', intent: inferredIntent() });
  assert.equal(plan.emotion.source, 'inferred');
  assert.equal(plan.emotion.binding, 'soft');
  assert.ok(!plan.constraints.some((constraint) => /binding/.test(constraint)));
});

test('the components channel carries emotion metadata but no emotion tokens', () => {
  const plan = searchPlan({ channel: 'components', brief: 'data table', emotion: '温暖治愈' });
  assert.equal(plan.emotion.binding, 'hard');
  assert.ok(plan.queries.every((query) => !/[\u4e00-\u9fff]/.test(query.text)));
});

test('a plan with no feeling keeps the emotion field null', () => {
  const plan = searchPlan({ channel: 'inspiration', brief: 'bakery' });
  assert.equal(plan.emotion, null);
});
