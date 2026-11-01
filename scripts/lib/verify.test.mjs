import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyProject } from './verify.mjs';
import { encodePng } from './png-fixture.mjs';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'verify.mjs');
const examplePath = path.join(here, '..', '..', 'examples', 'component-plan.example.json');

const examplePlan = async () => JSON.parse(await fs.readFile(examplePath, 'utf8'));

async function project(files = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cdf-verify-'));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { react: '19.0.0' } }));
  await fs.writeFile(path.join(root, 'components.json'), JSON.stringify({ aliases: { components: '@/components' } }));
  for (const [file, contents] of Object.entries(files)) {
    const target = path.join(root, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents);
  }
  return root;
}

test('a clean project passes and absent inputs are skipped', async () => {
  const root = await project();
  try {
    const report = await verifyProject({ plan: await examplePlan(), root });
    assert.equal(report.ok, true, JSON.stringify(report.checks));
    assert.deepEqual(report.checks.map((check) => `${check.id}:${check.status}`), [
      'plan:pass',
      'bundle:skipped',
      'i18n:skipped',
      'regression:skipped',
    ]);
    assert.deepEqual(report.summary, { pass: 1, warn: 0, fail: 0, skipped: 3 });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('a foundation mismatch fails the plan check', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cdf-verify-mantine-'));
  try {
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { '@mantine/core': '7.0.0' } }));
    const report = await verifyProject({ plan: await examplePlan(), root });
    assert.equal(report.ok, false);
    assert.equal(report.checks[0].status, 'fail');
    assert.ok(report.checks[0].errors.some((item) => item.code === 'foundation-not-in-project'));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

// High-entropy bytes so gzip cannot shrink the fixture below the budget.
const entropy = (size) => {
  const bytes = Buffer.alloc(size);
  let state = 0x9e3779b9;
  for (let index = 0; index < size; index += 1) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    bytes[index] = (state >>> 16) & 0xff;
  }
  return bytes;
};

test('a build over budget fails the bundle check', async () => {
  const root = await project({ '.next/static/chunks/a.js': entropy(40000) });
  try {
    await fs.writeFile(
      path.join(root, '.next', 'app-build-manifest.json'),
      JSON.stringify({ pages: { '/': ['static/chunks/a.js'] } }),
    );
    const plan = await examplePlan();
    plan.designIntent.performanceBudget.maxFirstLoadKb = 1;
    const report = await verifyProject({ plan, root });
    const bundle = report.checks.find((check) => check.id === 'bundle');
    assert.equal(bundle.status, 'fail');
    assert.ok(bundle.violations.some((violation) => violation.code === 'route-js-budget'));
    assert.equal(report.ok, false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('locale drift fails the i18n check', async () => {
  const root = await project({
    'locales/en.json': JSON.stringify({ save: 'Save changes', count: '{count} accounts' }),
    'locales/de.json': JSON.stringify({ save: 'Änderungen speichern' }),
  });
  try {
    const report = await verifyProject({ plan: await examplePlan(), root });
    const i18n = report.checks.find((check) => check.id === 'i18n');
    assert.equal(i18n.status, 'fail');
    assert.ok(i18n.issues.some((issue) => issue.code === 'missing-key'));
    assert.equal(report.ok, false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('a malformed locale file fails instead of disappearing', async () => {
  const root = await project({
    'locales/en.json': JSON.stringify({ save: 'Save changes' }),
    'locales/de.json': '{ not valid json',
  });
  try {
    const report = await verifyProject({ plan: await examplePlan(), root });
    const i18n = report.checks.find((check) => check.id === 'i18n');
    assert.equal(i18n.status, 'fail');
    assert.equal(i18n.parseErrors.length, 1);
    assert.equal(report.ok, false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('a changed capture fails the regression check', async () => {
  const white = encodePng(6, 6, () => [255, 255, 255]);
  const black = encodePng(6, 6, () => [0, 0, 0]);
  const root = await project({
    'qa/baseline/home.png': white,
    'qa/home.png': black,
  });
  try {
    const report = await verifyProject({ plan: await examplePlan(), root });
    const regression = report.checks.find((check) => check.id === 'regression');
    assert.equal(regression.status, 'fail');
    assert.equal(regression.failures[0].file, 'home.png');
    assert.equal(report.ok, false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('--skip removes a check instead of passing it', async () => {
  const root = await project({
    'locales/en.json': JSON.stringify({ save: 'Save changes' }),
    'locales/de.json': JSON.stringify({ save: '' }),
  });
  try {
    const report = await verifyProject({ plan: await examplePlan(), root, skip: ['i18n'] });
    assert.ok(!report.checks.some((check) => check.id === 'i18n'));
    assert.equal(report.ok, true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('the CLI reports JSON and exits 1 on failure', async () => {
  const root = await project({
    'locales/en.json': JSON.stringify({ save: 'Save changes' }),
    'locales/de.json': JSON.stringify({ save: '' }),
  });
  const planPath = path.join(root, 'plan.json');
  try {
    await fs.writeFile(planPath, JSON.stringify(await examplePlan()));

    await assert.rejects(
      run(process.execPath, [cli, '--plan', planPath, '--root', root, '--json']),
      (error) => {
        assert.equal(error.code, 1);
        const report = JSON.parse(error.stdout);
        assert.equal(report.ok, false);
        assert.equal(report.summary.fail, 1);
        return true;
      },
    );

    const skipped = await run(process.execPath, [cli, '--plan', planPath, '--root', root, '--skip', 'i18n', '--json']);
    assert.equal(JSON.parse(skipped.stdout).ok, true);

    await assert.rejects(
      run(process.execPath, [cli, '--plan', planPath, '--skip', 'nope']),
      (error) => error.code === 2 && /Unknown --skip value/.test(error.stderr),
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
