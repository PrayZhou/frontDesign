import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeLocales, flattenMessages, placeholdersOf, pseudoLocalize } from './i18n-stress.mjs';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'i18n-stress.mjs');

test('nested messages flatten to dot paths', () => {
  assert.deepEqual(flattenMessages({ a: { b: 'x' }, list: ['y'] }), { 'a.b': 'x', 'list.0': 'y' });
  assert.deepEqual(flattenMessages({ n: 3, flag: true }), { n: '3', flag: 'true' });
});

test('placeholders are discovered in every supported syntax', () => {
  const placeholders = placeholdersOf('{count} accounts for %s and %2$s, {{name}} ${total}');
  assert.deepEqual([...placeholders].sort(), ['%2$s', '%s', '${total}', '{{name}}', '{count}'].sort());
});

test('pseudo localization expands past its target and keeps brackets', () => {
  const value = pseudoLocalize('Save changes');
  assert.ok(value.startsWith('⟦') && value.endsWith('⟧'));
  assert.ok(value.length >= Math.ceil('Save changes'.length * 1.35), value);
  assert.notEqual(value, '⟦Save changes⟧');
});

test('pseudo localization never rewrites placeholders', () => {
  const source = '{count} accounts for {name}';
  const value = pseudoLocalize(source);
  assert.equal(placeholdersOf(value).size, placeholdersOf(source).size);
  assert.ok(value.includes('{count}') && value.includes('{name}'));
});

test('clean locales pass', () => {
  const result = analyzeLocales({
    en: { save: 'Save', count: '{count} accounts' },
    de: { save: 'Speichern', count: '{count} Konten' },
  }, { baseline: 'en' });
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.warnings, 0);
  assert.equal(result.baseline, 'en');
});

test('missing keys and placeholder drift are errors', () => {
  const result = analyzeLocales({
    en: { save: 'Save', count: '{count} accounts' },
    de: { count: '{total} Konten' },
  }, { baseline: 'en' });

  assert.ok(result.issues.some((issue) => issue.code === 'missing-key' && issue.key === 'save'));
  assert.ok(result.issues.some((issue) => issue.code === 'placeholder-mismatch'));
  assert.equal(result.summary.errors, 2);
});

test('empty values are errors', () => {
  const result = analyzeLocales({ en: { save: 'Save' }, de: { save: '  ' } }, { baseline: 'en' });
  assert.ok(result.issues.some((issue) => issue.code === 'empty-value'));
  assert.equal(result.summary.errors, 1);
});

test('expansion thresholds separate warning from error', () => {
  const warning = analyzeLocales(
    { en: { key: 'abcdefghijkl' }, de: { key: 'abcdefghijklmno' } },
    { baseline: 'en', warnExpansion: 1.2, maxExpansion: 1.6 },
  );
  assert.ok(warning.issues.some((issue) => issue.code === 'expansion-large'));
  assert.equal(warning.summary.errors, 0);

  const error = analyzeLocales(
    { en: { key: 'abcdefghijkl' }, de: { key: 'abcdefghijklmnopqrstuvwx' } },
    { baseline: 'en', warnExpansion: 1.5, maxExpansion: 1.8 },
  );
  assert.ok(error.issues.some((issue) => issue.code === 'expansion-too-large'));
  assert.equal(error.summary.errors, 1);
});

test('short labels are exempt from the ratio check', () => {
  const result = analyzeLocales(
    { en: { save: 'Save' }, de: { save: 'Speichern' } },
    { baseline: 'en', warnExpansion: 1.3, maxExpansion: 1.6 },
  );
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.warnings, 0);
  assert.equal(result.locales.find((locale) => locale.name === 'de').expansion.max, 1);
});

test('the CLI exits 1 on errors and prints a pseudo locale', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cdf-i18n-'));
  try {
    await fs.writeFile(path.join(dir, 'en.json'), JSON.stringify({ save: 'Save', count: '{count} accounts' }));
    await fs.writeFile(path.join(dir, 'de.json'), JSON.stringify({ save: 'Speichern' }));

    await assert.rejects(
      run(process.execPath, [cli, '--dir', dir, '--baseline', 'en', '--json']),
      (error) => {
        assert.equal(error.code, 1);
        const report = JSON.parse(error.stdout);
        assert.equal(report.summary.errors, 1);
        assert.equal(report.locales.find((locale) => locale.name === 'de').missing, 1);
        return true;
      },
    );

    const pseudo = await run(process.execPath, [cli, '--dir', dir, '--baseline', 'en', '--pseudo']);
    const messages = JSON.parse(pseudo.stdout);
    assert.ok(messages.save.startsWith('⟦'));
    assert.match(messages.count, /\{count\}/);

    await assert.rejects(
      run(process.execPath, [cli, '--dir', path.join(dir, 'nope')]),
      (error) => error.code === 2 && /No locale JSON files/.test(error.stderr),
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
