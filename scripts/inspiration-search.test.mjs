import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, 'inspiration-search.mjs');

test('--channel components emits a JSON plan', async () => {
  const { stdout } = await run(process.execPath, [cli, '--channel', 'components', '--brief', 'data table', '--json']);
  const plan = JSON.parse(stdout);
  assert.equal(plan.channel, 'components');
  assert.deepEqual(plan.tiers, ['T1']);
  assert.ok(plan.targets.length > 0);
});

test('--normalize writes evidence records to --out', async () => {
  const input = path.join(os.tmpdir(), `cdff-captured-${process.pid}.json`);
  const out = path.join(os.tmpdir(), `cdff-evidence-${process.pid}.json`);
  await fs.writeFile(input, JSON.stringify({ references: [
    { url: 'https://dribbble.com/shots/1', publisher: 'Dribbble', tier: 'T3', claim: 'One dominant task above the fold.', capturedAt: '2026-09-13' },
  ] }));
  try {
    await run(process.execPath, [cli, '--normalize', '--input', input, '--out', out, '--json']);
    const records = JSON.parse(await fs.readFile(out, 'utf8'));
    assert.equal(records.length, 1);
    assert.equal(records[0].type, 'observed-pattern');
  } finally {
    await fs.rm(input, { force: true });
    await fs.rm(out, { force: true });
  }
});

test('--audit-plan exits 1 on a tier violation', async () => {
  const file = path.join(os.tmpdir(), `cdff-audit-${process.pid}.json`);
  await fs.writeFile(file, JSON.stringify({ regions: [{ selection: { source: 'dribbble.com', component: 'hero' } }] }));
  try {
    await run(process.execPath, [cli, '--audit-plan', file, '--json']);
    assert.fail('expected a non-zero exit code');
  } catch (error) {
    assert.equal(error.code, 1);
    const result = JSON.parse(error.stdout);
    assert.equal(result.valid, false);
    assert.equal(result.violations[0].code, 'inspiration-source-as-candidate');
  } finally {
    await fs.rm(file, { force: true });
  }
});

test('missing required options exit 2', async () => {
  await assert.rejects(
    run(process.execPath, [cli, '--channel', 'inspiration']),
    (error) => error.code === 2 && /--brief is required/.test(error.stderr),
  );
});

test('--emotion appears in the JSON plan', async () => {
  const { stdout } = await run(process.execPath, [
    cli, '--channel', 'inspiration', '--brief', 'bakery', '--emotion', '温暖治愈', '--json',
  ]);
  const plan = JSON.parse(stdout);
  assert.equal(plan.emotion.text, '温暖治愈');
  assert.equal(plan.emotion.source, 'user-provided');
  assert.equal(plan.emotion.binding, 'hard');
});
