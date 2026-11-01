import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkContrast,
  contrastRatio,
  deriveTokenPairs,
  parseColor,
  resolveTokenPairs,
  toHex,
} from './contrast.mjs';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'check-contrast.mjs');

const near = (actual, expected, tolerance = 1) => Math.abs(actual - expected) <= tolerance;

test('parses hex, rgb, hsl, and oklch', () => {
  const hex = parseColor('#0a0a0a');
  assert.deepEqual({ r: hex.r, g: hex.g, b: hex.b, a: hex.a }, { r: 10, g: 10, b: 10, a: 1 });

  const short = parseColor('#fff');
  assert.deepEqual({ r: short.r, g: short.g, b: short.b }, { r: 255, g: 255, b: 255 });

  const rgb = parseColor('rgb(0 0 0 / 50%)');
  assert.equal(rgb.a, 0.5);

  const hsl = parseColor('hsl(0 100% 50%)');
  assert.equal(toHex(hsl), '#ff0000');

  const oklch = parseColor('oklch(0.6279 0.2577 29.23)');
  assert.ok(oklch.r > 240 && oklch.g < 40 && oklch.b < 40, `oklch red parsed as ${toHex(oklch)}`);

  const white = parseColor('oklch(1 0 0)');
  assert.equal(toHex(white), '#ffffff');
});

test('rejects unsupported color syntax', () => {
  assert.throws(() => parseColor('color-mix(in oklch, red, blue)'), /resolved before a contrast check/);
  assert.throws(() => parseColor('not-a-color'), /Unsupported color/);
});

test('contrast ratio matches the WCAG reference values', () => {
  assert.ok(near(contrastRatio(parseColor('#000'), parseColor('#fff')), 21, 0.01));
  assert.ok(near(contrastRatio(parseColor('#767676'), parseColor('#fff')), 4.54, 0.02));
  assert.ok(near(contrastRatio(parseColor('#777777'), parseColor('#fff')), 4.48, 0.02));
});

test('translucent text composites over its background', () => {
  const ratio = contrastRatio(parseColor('rgb(0 0 0 / 50%)'), parseColor('#fff'));
  assert.ok(near(ratio, 3.98, 0.03), `expected about 3.98, received ${ratio}`);
});

test('a translucent background is refused instead of guessed', () => {
  assert.throws(
    () => contrastRatio(parseColor('#000'), parseColor('rgb(255 255 255 / 40%)')),
    (error) => error.code === 'ALPHA_BACKGROUND',
  );
});

test('token pairs follow the shape of the theme', () => {
  const pairs = deriveTokenPairs([
    { name: '--background', value: '#ffffff' },
    { name: '--foreground', value: '#0a0a0a' },
    { name: '--primary', value: '#1d4ed8' },
    { name: '--primary-foreground', value: '#ffffff' },
    { name: '--muted', value: '#f5f5f5' },
    { name: '--muted-foreground', value: '#767676' },
    { name: '--border', value: '#e5e5e5' },
  ]);
  const labels = pairs.map((pair) => `${pair.foreground} on ${pair.background} (${pair.kind})`);

  assert.ok(labels.includes('foreground on background (text)'));
  assert.ok(labels.includes('primary-foreground on primary (text)'));
  assert.ok(labels.includes('muted-foreground on muted (text)'));
  assert.ok(labels.includes('muted-foreground on background (text)'));
  assert.ok(labels.includes('border on background (ui)'));
  assert.ok(!labels.some((label) => label.startsWith('ring')), 'missing tokens must not produce pairs');
});

test('checkContrast fails below the requested level', () => {
  const pairs = [
    { label: 'body', foreground: '#767676', background: '#ffffff' },
    { label: 'faint', foreground: '#cccccc', background: '#ffffff' },
  ];
  const aa = checkContrast(pairs);
  assert.equal(aa.summary.total, 2);
  assert.equal(aa.summary.failed, 1);
  assert.equal(aa.pairs[0].pass, true);
  assert.equal(aa.pairs[1].pass, false);

  const aaa = checkContrast(pairs, { level: 'AAA' });
  assert.equal(aaa.pairs[0].required, 7);
  assert.equal(aaa.pairs[0].pass, false);
});

test('unparseable colors become pair errors, not crashes', () => {
  const result = checkContrast([{ label: 'odd', foreground: 'oklch(var(--x))', background: '#fff' }]);
  assert.equal(result.pairs[0].pass, false);
  assert.match(result.pairs[0].error, /needs three channels/);
});

test('resolveTokenPairs explains unknown tokens', () => {
  const variables = [{ name: '--foreground', value: '#111' }];
  assert.throws(() => resolveTokenPairs(variables, ['foreground:background']), /Unknown token\(s\): background/);
});

test('the CLI passes, fails, and lists pairs', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cdf-contrast-'));
  try {
    await fs.mkdir(path.join(root, 'src'), { recursive: true });
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { react: '19.0.0' } }));
    await fs.writeFile(
      path.join(root, 'src', 'globals.css'),
      ':root { --background: #ffffff; --foreground: #0a0a0a; --muted-foreground: #777777; }',
    );

    const pass = await run(process.execPath, [cli, '--root', root, '--pairs', 'foreground:background', '--json']);
    assert.equal(JSON.parse(pass.stdout).summary.failed, 0);

    await assert.rejects(
      run(process.execPath, [cli, '--root', root, '--pairs', 'muted-foreground:background']),
      (error) => error.code === 1 && /FAIL/.test(error.stdout),
    );

    const list = await run(process.execPath, [cli, '--root', root, '--list', '--json']);
    const derived = JSON.parse(list.stdout).pairs;
    assert.ok(derived.some((pair) => pair.foreground === 'muted-foreground' && pair.background === 'background'));

    await assert.rejects(
      run(process.execPath, [cli, '--color', '#111111:#ffffff', '--color', '#eeeeee:#ffffff', '--json']),
      (error) => {
        assert.equal(error.code, 1);
        const result = JSON.parse(error.stdout);
        assert.equal(result.summary.total, 2);
        assert.equal(result.summary.failed, 1);
        return true;
      },
    );

    await assert.rejects(
      run(process.execPath, [cli, '--root', root, '--pairs', 'foreground:nope']),
      (error) => error.code === 2 && /Unknown token/.test(error.stderr),
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
