import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diffPlans, evaluateFailOn } from './plan-diff.mjs';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'plan-diff.mjs');

const region = (id, overrides = {}) => ({
  id,
  need: 'need',
  capabilities: ['data'],
  selection: { source: 'foundation', component: 'card' },
  reason: 'reason',
  states: ['loading', 'empty', 'error', 'success'],
  responsive: 'Priority columns below 768px',
  accessibility: { semantics: 'labelled region' },
  ...overrides,
});

const basePlan = () => ({
  version: 1,
  designIntent: {
    product: 'Ops dashboard',
    audience: 'Support leads',
    coreTask: 'Find at-risk accounts',
    visualDirection: 'Calm workspace',
    density: 'comfortable',
    principles: ['One question dominates', 'States share geometry'],
    primaryAction: 'Open the list',
    successCriteria: ['List reachable in one scroll at 320px'],
    tokens: { spacingRhythm: '8px base' },
    contrastPairs: [{ foreground: 'foreground', background: 'background' }],
  },
  foundation: 'shadcn',
  enhancer: null,
  dependencies: [{ name: 'recharts', reason: 'charts', new: false }],
  regions: [region('results')],
});

test('an unchanged plan has no changes', () => {
  const report = diffPlans(basePlan(), basePlan());
  assert.equal(report.counts.total, 0);
  assert.equal(report.summary.regionsChanged, false);
});

test('a foundation change is reported', () => {
  const after = basePlan();
  after.foundation = 'mantine';
  const report = diffPlans(basePlan(), after);
  assert.equal(report.summary.foundationChanged, true);
  assert.ok(report.changes.some((change) => change.path === '/foundation' && change.type === 'changed'));
});

test('regions diff by id, so inserting one does not renumber the rest', () => {
  const after = basePlan();
  after.regions = [region('summary'), region('results')];

  const report = diffPlans(basePlan(), after);
  assert.deepEqual(report.summary.addedRegions, ['summary']);
  assert.deepEqual(report.summary.removedRegions, []);
  assert.equal(report.counts.total, 1, JSON.stringify(report.changes));
});

test('removed dependencies and changed capabilities are reported', () => {
  const after = basePlan();
  after.dependencies = [];
  after.regions = [region('results', { capabilities: ['data', 'table'] })];

  const report = diffPlans(basePlan(), after);
  assert.equal(report.summary.dependenciesChanged, true);
  assert.equal(report.summary.capabilitiesChanged, true);
  assert.ok(report.changes.some((change) => change.path === '/dependencies/recharts' && change.type === 'removed'));
});

test('set arrays and contrast pairs diff semantically', () => {
  const after = basePlan();
  after.designIntent.successCriteria = ['List reachable in one scroll at 320px', 'Contrast decided from tokens'];
  after.designIntent.contrastPairs = [{ foreground: 'muted-foreground', background: 'background' }];

  const report = diffPlans(basePlan(), after);
  assert.equal(report.summary.successCriteriaChanged, true);
  assert.equal(report.summary.contrastPairsChanged, true);
  assert.ok(report.changes.some((change) => change.type === 'added' && change.after === 'Contrast decided from tokens'));
});

test('fail-on blocks only the requested areas', () => {
  const after = basePlan();
  after.foundation = 'mantine';
  after.regions = [region('results', { capabilities: ['data', 'table'] })];

  const report = diffPlans(basePlan(), after);
  assert.deepEqual(evaluateFailOn(report.summary, ['regions']), ['regions']);
  assert.deepEqual(evaluateFailOn(report.summary, ['contrastPairs']), []);
  assert.deepEqual(evaluateFailOn(report.summary, ['any']), ['any']);
  assert.throws(() => evaluateFailOn(report.summary, ['nope']), /Unknown --fail-on value/);
});

test('the CLI exits 1 only when --fail-on matches', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cdf-diff-'));
  const before = path.join(dir, 'before.json');
  const after = path.join(dir, 'after.json');
  try {
    const changed = basePlan();
    changed.foundation = 'mantine';
    await fs.writeFile(before, JSON.stringify(basePlan()));
    await fs.writeFile(after, JSON.stringify(changed));

    const reportOnly = await run(process.execPath, [cli, '--before', before, '--after', after]);
    assert.match(reportOnly.stdout, /foundation/);

    await assert.rejects(
      run(process.execPath, [cli, '--before', before, '--after', after, '--fail-on', 'foundation']),
      (error) => error.code === 1 && /Blocked by --fail-on: foundation/.test(error.stdout),
    );

    const json = await run(process.execPath, [cli, '--before', before, '--after', after, '--fail-on', 'regions', '--json']);
    const parsed = JSON.parse(json.stdout);
    assert.deepEqual(parsed.blocked, []);
    assert.equal(parsed.summary.foundationChanged, true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
