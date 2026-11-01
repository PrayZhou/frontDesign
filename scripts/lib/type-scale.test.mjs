import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTypeScale, renderTypeScaleMarkdown } from './type-scale.mjs';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'type-scale.mjs');

test('defaults produce a 1.25 scale from a 16px body', () => {
  const scale = buildTypeScale();
  assert.equal(scale.base, 16);
  assert.equal(scale.ratio, 1.25);
  assert.deepEqual(scale.tokens.map((token) => [token.name, token.px]), [
    ['label', 13],
    ['body', 16],
    ['lead', 20],
    ['title', 25],
    ['heading', 31.5],
    ['display', 39],
  ]);
  assert.equal(scale.tokens[1].lineHeight, 1.6);
  assert.equal(scale.tokens[1].measure, '65ch');
  assert.equal(scale.tokens[0].tracking, '0.02em');
});

test('every size comes from the same ratio', () => {
  const scale = buildTypeScale({ base: 18, ratio: 1.2, levels: 4 });
  assert.deepEqual(scale.tokens.map((token) => token.name), ['label', 'body', 'lead', 'title']);
  assert.deepEqual(scale.tokens.map((token) => token.px), [15, 18, 21.5, 26]);
});

test('base, ratio, and level bounds are enforced', () => {
  assert.throws(() => buildTypeScale({ ratio: 3 }), /--ratio must be between/);
  assert.throws(() => buildTypeScale({ base: 4 }), /--body must be between/);
  assert.throws(() => buildTypeScale({ levels: 2 }), /--levels must be between/);
  assert.throws(() => buildTypeScale({ base: 'wide' }), /--body must be a number/);
});

test('css output names every token', () => {
  const css = buildTypeScale({ levels: 3 }).css;
  assert.match(css, /:root \{/);
  assert.match(css, /--text-label: 13px;/);
  assert.match(css, /--text-body-line: 1.6;/);
  assert.match(css, /--text-body-tracking: 0;/);
});

test('markdown table states the derivation', () => {
  const markdown = renderTypeScaleMarkdown(buildTypeScale());
  assert.match(markdown, /\| body \| 16 \| 1 \| 1.6 \|/);
  assert.match(markdown, /Use 3–4 of these per page/);
});

test('the CLI emits css and json, and rejects bad input', async () => {
  const css = await run(process.execPath, [cli, '--format', 'css']);
  assert.match(css.stdout, /--text-display: 39px;/);

  const json = await run(process.execPath, [cli, '--json']);
  assert.equal(JSON.parse(json.stdout).tokens.length, 6);

  await assert.rejects(
    run(process.execPath, [cli, '--ratio', '9']),
    (error) => error.code === 2 && /--ratio must be between/.test(error.stderr),
  );
  await assert.rejects(
    run(process.execPath, [cli, '--format', 'pdf']),
    (error) => error.code === 2 && /--format must be css, md, or json/.test(error.stderr),
  );
});
