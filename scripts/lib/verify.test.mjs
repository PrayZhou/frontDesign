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

test('required checks fail on missing inputs and keep optional skips in JSON and text', async (t) => {
  const root = await project();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const args = [cli, '--root', root, '--plan', examplePath, '--require', 'bundle, regression'];
  await assert.rejects(run(process.execPath, [...args, '--json']), error => {
    assert.equal(error.code, 1);
    const report = JSON.parse(error.stdout);
    assert.equal(report.ok, false);
    assert.deepEqual(report.summary, { pass: 1, warn: 0, fail: 2, skipped: 1 });
    for (const id of ['bundle', 'regression']) {
      const check = report.checks.find(item => item.id === id);
      assert.equal(check.code, 'required-input-missing');
      assert.ok(check.reason);
    }
    return true;
  });
  await assert.rejects(run(process.execPath, args), error => {
    assert.equal(error.code, 1);
    assert.match(error.stdout, /fail\s+bundle[^\n]*production build/i);
    assert.match(error.stdout, /fail\s+regression[^\n]*baseline/i);
    return true;
  });
});

test('requirements accumulate and all four checks can pass on real inputs', async (t) => {
  const png = encodePng(2, 2, () => [10, 20, 30]);
  const root = await project({
    '.next/app-build-manifest.json': JSON.stringify({ pages: { '/': ['static/app.js'] } }),
    '.next/static/app.js': 'let x=1',
    'qa/home.png': png,
    'qa/baseline/home.png': png,
    'locales/en/common.json': '{"save":"Save"}',
    'locales/zh/common.json': '{"save":"保存"}',
  });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const args = [cli, '--plan', examplePath, '--root', root, '--require', 'plan,bundle', '--require', 'i18n,regression', '--json'];
  const report = JSON.parse((await run(process.execPath, args)).stdout);
  assert.equal(report.summary.pass, 4);
  await fs.unlink(path.join(root, '.next/static/app.js'));
  await assert.rejects(run(process.execPath, args), error => {
    assert.equal(error.code, 1);
    assert.equal(JSON.parse(error.stdout).checks.find(check => check.id === 'bundle').status, 'fail');
    return true;
  });
});

test('invalid, empty and contradictory requirements exit 2 including repeated flags', async () => {
  for (const args of [
    ['--require', 'bundel'], ['--require', ','], ['--require', 'plan,'],
    ['--require', 'bundle', '--require', 'plan', '--skip', 'bundle'],
    ['--skip', 'bundle', '--skip', 'i18n', '--require', 'bundle'],
  ]) {
    await assert.rejects(run(process.execPath, [cli, '--plan', examplePath, ...args]), error => {
      assert.equal(error.code, 2);
      assert.match(error.stderr, /--require/);
      assert.doesNotMatch(error.stderr, /Unknown option/);
      return true;
    });
  }
});

test('both CLI entry points report the same namespace-qualified translation defects', async (t) => {
  const root = await project({
    'locales/en/common.json': '{"save":"Save","welcome":"Hello {name}"}',
    'locales/zh/common.json': '{"welcome":"你好 {user}"}',
    'locales/en/admin/alerts.json': '{"critical":"Critical"}',
    'locales/en/admin/forms.json': '{"save":"Apply"}',
    'locales/zh/admin/forms.json': '{"save":"应用"}',
    'locales/en.json': '{"cancel":"Cancel"}',
    'locales/zh.json': '{"cancel":"取消"}',
  });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const standalone = [path.join(here, '..', 'i18n-stress.mjs'), '--dir', path.join(root, 'locales')];
  for (const [command, combined] of [[standalone, false], [[cli, '--root', root, '--plan', examplePath], true]]) {
    await assert.rejects(run(process.execPath, [...command, '--json']), error => {
      assert.equal(error.code, 1);
      const report = JSON.parse(error.stdout);
      const check = combined ? report.checks.find(item => item.id === 'i18n') : report;
      assert.equal(check.baseline, 'en');
      assert.deepEqual(check.issues.map(item => [item.locale, item.code, item.key]), [
        ['zh', 'missing-key', 'admin.alerts.critical'],
        ['zh', 'missing-key', 'common.save'],
        ['zh', 'placeholder-mismatch', 'common.welcome'],
      ]);
      return true;
    });
  }
  const generated = JSON.parse((await run(process.execPath, [...standalone, '--baseline', 'en', '--pseudo'])).stdout);
  assert.deepEqual(Object.keys(generated).sort(), ['admin.alerts.critical', 'admin.forms.save', 'cancel', 'common.save', 'common.welcome']);
});

test('conflicting flat and directory keys fail with both source paths', async (t) => {
  const root = await project({ 'locales/en.json': '{"common.save":"A"}', 'locales/en/common.json': '{"save":"B"}' });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const report = await verifyProject({ root, plan: await examplePlan() });
  const i18n = report.checks.find(check => check.id === 'i18n');
  assert.equal(i18n.status, 'fail');
  assert.match(i18n.parseErrors.join('\n'), /common\.save/);
  assert.match(i18n.parseErrors.join('\n'), /en\.json/);
  assert.match(i18n.parseErrors.join('\n'), /en\/common\.json/);
  await assert.rejects(run(process.execPath, [path.join(here, '..', 'i18n-stress.mjs'), '--dir', path.join(root, 'locales'), '--pseudo']),
    error => error.code === 2 && error.stderr.includes('common.save'));
});

test('required i18n fails for missing input, accepts warnings and rejects malformed input', async (t) => {
  const root = await project();
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const options = { root, plan: await examplePlan(), require: ['i18n'] };
  assert.equal((await verifyProject(options)).ok, false);
  const dir = path.join(root, 'locales');
  await fs.mkdir(dir);
  await fs.writeFile(path.join(dir, 'en.json'), '{"save":"Save"}');
  await fs.writeFile(path.join(dir, 'de.json'), '{"save":"Speichern","extra":"Text"}');
  const warning = await verifyProject(options);
  assert.equal(warning.ok, true);
  assert.equal(warning.checks.find(check => check.id === 'i18n').status, 'warn');
  await fs.writeFile(path.join(dir, 'de.json'), '{');
  assert.equal((await verifyProject(options)).ok, false);
});

test('a required regression check needs a baseline for every current capture', async (t) => {
  const png = encodePng(2, 2, () => [10, 20, 30]);
  const root = await project({ 'qa/baseline/home.png': png, 'qa/home.png': png, 'qa/mobile.png': png });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const options = { root, plan: await examplePlan() };
  const local = await verifyProject(options);
  assert.equal(local.ok, true);
  const report = await verifyProject({ ...options, require: ['regression'] });
  const regression = report.checks.find(check => check.id === 'regression');
  assert.equal(report.ok, false);
  assert.equal(regression.status, 'fail');
  assert.deepEqual(regression.failures, [{ file: 'mobile.png', status: 'new' }]);
  assert.equal(regression.summary.passed, 1);
});

test('empty build and empty baseline dictionary cannot satisfy required measurements', async (t) => {
  const root = await project({
    'dist/assets/readme.txt': 'no shipped JS or CSS',
    'locales/en.json': '{}',
    'locales/zh.json': '{"save":"保存"}',
  });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const report = await verifyProject({ root, plan: await examplePlan(), require: ['bundle', 'i18n'] });
  assert.equal(report.summary.fail, 2);
  for (const id of ['bundle', 'i18n']) {
    assert.equal(report.checks.find(check => check.id === id).code, 'required-input-missing');
  }
});

test('required visual regression cannot compare a baseline directory to itself', async (t) => {
  const root = await project({ 'qa/baseline/home.png': encodePng(2, 2, () => [1, 2, 3]) });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.symlink(path.join(root, 'qa/baseline'), path.join(root, 'current'), 'junction');
  await assert.rejects(run(process.execPath, [cli, '--plan', examplePath, '--root', root,
    '--require', 'regression', '--qa', 'current', '--baseline', 'qa/baseline']),
    error => error.code === 2 && /different directories/.test(error.stderr));
});
