// Run the public emitter and its output against actual browser fixtures.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile, mkdir, symlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const resolve = createRequire(import.meta.url).resolve;
const root = await mkdtemp(path.join(tmpdir(), 'support-qa-proof-'));
const runner = resolve('@playwright/test/cli');
const plan = { designIntent: { primaryAction: 'Review accounts', visualQaTargets: { viewports: ['320'] } } };
const cases = [
  { id: 'healthy', markup: '<button>Review accounts</button>', keyboard: 'passed', axe: 'passed' },
  { id: 'pointer-only', markup: '<button tabindex="-1">Review accounts</button>', keyboard: 'failed', axe: 'passed' },
  { id: 'missing-label', markup: '<button>Review accounts</button><button></button>', keyboard: 'passed', axe: 'failed' },
  { id: 'optional-axe', markup: '<a href="#accounts">Review accounts</a>', keyboard: 'passed', axe: 'skipped' },
];

try {
  await writeFile(path.join(root, 'plan.json'), JSON.stringify(plan));
  for (const item of cases) {
    const dir = path.join(root, item.id);
    const modules = path.join(dir, 'node_modules');
    await mkdir(path.join(modules, '@playwright'), { recursive: true });
    await symlink(path.dirname(resolve('@playwright/test/package.json')), path.join(modules, '@playwright/test'));
    if (item.axe !== 'skipped') {
      await mkdir(path.join(modules, '@axe-core'));
      await symlink(path.join(import.meta.dirname, 'node_modules/@axe-core/playwright'), path.join(modules, '@axe-core/playwright'));
    }
    const html = path.join(dir, 'fixture.html');
    await writeFile(html, '<!doctype html><html lang="en"><title>Queue</title><main id="accounts"><h1>Queue</h1>' + item.markup + '</main></html>');
    const emit = spawnSync(process.execPath, [
      path.join(import.meta.dirname, '../../scripts/visual-qa-plan.mjs'), '--file', path.join(root, 'plan.json'),
      '--route', pathToFileURL(html).href, '--emit', 'playwright', '--out', path.join(dir, 'qa.spec.mjs'),
    ], { encoding: 'utf8' });
    assert.equal(emit.status, 0, emit.stderr);
    const config = { workers: 1, retries: 0, use: { channel: process.env.PW_CHANNEL || undefined } };
    await writeFile(path.join(dir, 'playwright.config.mjs'), 'export default ' + JSON.stringify(config));
    const result = spawnSync(process.execPath, [runner, 'test', '--grep', 'keyboard path|axe scan', '--reporter=json'], {
      cwd: dir, encoding: 'utf8', timeout: 90000,
    });
    assert.ok(result.stdout, result.stderr || String(result.error));
    const report = JSON.parse(result.stdout);
    assert.deepEqual(report.errors, []);
    const specs = [];
    function visit(suite) {
      specs.push(...(suite.specs || []));
      for (const child of suite.suites || []) visit(child);
    }
    visit(report);
    for (const [name, expected] of [['keyboard path', item.keyboard], ['axe scan', item.axe]]) {
      const matches = specs.filter(s => s.title.startsWith(name));
      assert.equal(matches.length, 1);
      const observed = matches[0].tests[0].results[0];
      assert.equal(observed.status, expected, item.id + ' / ' + name + ': ' + (observed.error?.message || observed.status));
      if (expected === 'failed') {
        assert.match(observed.error.message, name === 'axe scan' ? /button-name/ : /focus|Tab/i);
      }
      console.log(item.id, name, observed.status);
    }
    assert.equal(result.status, [item.keyboard, item.axe].includes('failed') ? 1 : 0);
  }
} finally {
  await rm(root, { recursive: true, force: true });
}
