import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { budgetsFromPlan, inspectBundle, measureBuffer } from './bundle-budget.mjs';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'bundle-budget.mjs');

// High-entropy bytes: gzip cannot shrink repetitive filler to a few bytes, which would make
// every budget assertion vacuous.
const chunk = (size) => {
  const bytes = Buffer.alloc(size);
  let state = 0x2545f491;
  for (let index = 0; index < size; index += 1) {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    bytes[index] = (state >>> 16) & 0xff;
  }
  return bytes;
};

async function nextFixture({ pages = {}, sizes = {} } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cdf-bundle-'));
  await fs.mkdir(path.join(root, '.next', 'static', 'chunks'), { recursive: true });
  await fs.writeFile(
    path.join(root, '.next', 'app-build-manifest.json'),
    JSON.stringify({ pages }),
  );
  for (const [file, size] of Object.entries(sizes)) {
    await fs.writeFile(path.join(root, '.next', 'static', 'chunks', file), chunk(size));
  }
  return root;
}

test('gzip and brotli measurements are smaller than raw', () => {
  const metrics = measureBuffer(Buffer.from('x'.repeat(4096)));
  assert.equal(metrics.rawBytes, 4096);
  assert.ok(metrics.gzipBytes > 0 && metrics.gzipBytes < metrics.rawBytes);
  assert.ok(metrics.brotliBytes > 0 && metrics.brotliBytes < metrics.rawBytes);
});

test('per-route first-load JS sums the shared and route chunks', async () => {
  const root = await nextFixture({
    pages: {
      '/': ['static/chunks/shared.js', 'static/chunks/home.js'],
      '/about': ['static/chunks/shared.js'],
    },
    sizes: { 'shared.js': 2048, 'home.js': 6144 },
  });

  try {
    const report = await inspectBundle({ root });
    assert.equal(report.source, 'next-app');

    const home = report.routes.find((route) => route.route === '/');
    const about = report.routes.find((route) => route.route === '/about');
    assert.ok(home.jsKb > about.jsKb, 'the home route loads one more chunk');
    assert.equal(home.chunks, 2);
    assert.equal(report.totals.js.files, 2);
    assert.ok(report.largest[0].gzipKb >= report.largest[1].gzipKb);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('budgets produce violations with the measured values', async () => {
  const root = await nextFixture({
    pages: { '/': ['static/chunks/shared.js'] },
    sizes: { 'shared.js': 20000 },
  });

  try {
    const report = await inspectBundle({ root, budgets: { routeKb: 1, cssKb: 1 } });
    const codes = report.violations.map((violation) => violation.code);
    assert.ok(codes.includes('route-js-budget'));
    assert.ok(report.violations.every((violation) => violation.actualKb > violation.limitKb));

    const withinBudget = await inspectBundle({ root, budgets: { routeKb: 1000, cssKb: 1000 } });
    assert.deepEqual(withinBudget.violations, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('a missing manifest falls back to a static asset directory', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cdf-bundle-dist-'));
  try {
    await fs.mkdir(path.join(root, 'dist', 'assets'), { recursive: true });
    await fs.writeFile(path.join(root, 'dist', 'assets', 'app.js'), chunk(3000));
    await fs.writeFile(path.join(root, 'dist', 'assets', 'app.css'), chunk(1500));

    const report = await inspectBundle({ root });
    assert.equal(report.source, 'directory');
    assert.equal(report.buildDirectory, 'dist/assets');
    assert.deepEqual(report.routes, []);
    assert.equal(report.totals.css.files, 1);
    assert.ok(report.totals.js.gzipKb > 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('no build output is reported, not guessed', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cdf-bundle-empty-'));
  try {
    const report = await inspectBundle({ root });
    assert.equal(report.source, null);
    assert.match(report.warnings[0], /No production build output/);

    await assert.rejects(
      run(process.execPath, [cli, '--root', root]),
      (error) => error.code === 2 && /No production build output/.test(error.stderr),
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('plan budgets are read from performanceBudget', () => {
  const budgets = budgetsFromPlan({
    designIntent: { performanceBudget: { maxFirstLoadKb: 180, maxCssKb: 40 } },
  });
  assert.deepEqual(budgets, { routeKb: 180, cssKb: 40 });
  assert.deepEqual(budgetsFromPlan({}), {});
});

test('the CLI fails on a budget violation and honours plan budgets', async () => {
  const root = await nextFixture({
    pages: { '/': ['static/chunks/shared.js'] },
    sizes: { 'shared.js': 20000 },
  });
  const planPath = path.join(root, 'plan.json');
  try {
    await fs.writeFile(planPath, JSON.stringify({
      designIntent: { performanceBudget: { maxFirstLoadKb: 1 } },
    }));

    await assert.rejects(
      run(process.execPath, [cli, '--root', root, '--plan', planPath]),
      (error) => error.code === 1 && /route-js-budget/.test(error.stdout),
    );

    const json = await run(process.execPath, [cli, '--root', root, '--json']);
    const report = JSON.parse(json.stdout);
    assert.equal(report.source, 'next-app');
    assert.equal(report.budgets.routeKb, 250);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
