import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateComponentPlan } from './plan-validator.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const examplePath = path.join(here, '..', '..', 'examples', 'component-plan.example.json');

// The canonical example is part of the contract: if it stops passing, the docs are lying.
test('the example plan passes strict validation with no warnings', async () => {
  const plan = JSON.parse(await fs.readFile(examplePath, 'utf8'));
  const result = validateComponentPlan(plan);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.deepEqual(result.warnings, []);
  assert.equal(result.summary.regionCount, 2);
});

test('the example plan exercises the documented contract fields', async () => {
  const plan = JSON.parse(await fs.readFile(examplePath, 'utf8'));
  const intent = plan.designIntent;
  for (const field of ['primaryAction', 'successCriteria', 'tokens', 'contrastPairs', 'styleDirections',
    'selectedStyleDirection', 'visualLanguage', 'emotionalIntent', 'responsiveContract',
    'performanceBudget', 'visualQaTargets', 'evidence']) {
    assert.ok(intent[field] !== undefined, `example must demonstrate ${field}`);
  }
  assert.equal(plan.regions.filter((region) => region.emotionalRole === 'focal').length, 1);
  assert.ok(plan.regions.every((region) => region.contentModel));
});
