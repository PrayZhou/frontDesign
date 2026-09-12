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
  assert.ok(plan.targets.every((target) => target.tier === 'T1'));
  assert.ok(plan.queries.every((query) => query.purpose === 'component-candidate'));
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
