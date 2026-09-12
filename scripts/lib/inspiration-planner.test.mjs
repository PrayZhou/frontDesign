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
