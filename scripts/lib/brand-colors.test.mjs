import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { comparePaletteToTokens, extractPalette, inspectBrandColors, resolveThemeColors } from './brand-colors.mjs';
import { decodePng } from './png.mjs';
import { encodePng } from './png-fixture.mjs';

const bands = (colors, height = 40) => encodePng(40, height, (x, y) => colors[Math.floor((y / height) * colors.length)]);

test('extracts dominant colors with shares', () => {
  const image = decodePng(bands([[224, 90, 58], [255, 255, 255], [17, 24, 39]]));
  const { palette, samples } = extractPalette(image, { limit: 3 });

  assert.equal(palette.length, 3);
  assert.equal(palette[0].hex, '#e05a3a');
  assert.ok(palette[0].share > 0.3, `unexpected share ${palette[0].share}`);
  assert.ok(samples > 0);
});

test('palette entries match theme tokens within an OKLab distance', () => {
  const { palette } = extractPalette(decodePng(bands([[224, 90, 58]])), { limit: 1 });
  const themeColors = resolveThemeColors([
    { name: '--background', value: '#ffffff' },
    { name: '--primary', value: '#e05a3a' },
    { name: '--radius', value: '0.625rem' },
  ]);
  assert.equal(themeColors.length, 2, 'non-color tokens are skipped');

  const [matched] = comparePaletteToTokens(palette, themeColors);
  assert.equal(matched.matched, true);
  assert.equal(matched.nearestToken, '--primary');

  const [unmatched] = comparePaletteToTokens(palette, resolveThemeColors([{ name: '--primary', value: '#111827' }]));
  assert.equal(unmatched.matched, false);
  assert.ok(unmatched.distance > 0.12);
});

test('transparent pixels are ignored', () => {
  const image = decodePng(encodePng(10, 10, () => [255, 0, 0, 0]));
  const { palette, samples } = extractPalette(image);
  assert.equal(samples, 0);
  assert.deepEqual(palette, []);
});

test('inspectBrandColors reports tokens and flags unmatched brand colors', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cdf-brand-'));
  try {
    await fs.mkdir(path.join(root, 'assets'), { recursive: true });
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { react: '19.0.0' } }));
    await fs.writeFile(
      path.join(root, 'globals.css'),
      ':root { --background: #ffffff; --primary: #e05a3a; --radius: 8px; }',
    );
    await fs.writeFile(path.join(root, 'assets', 'logo.png'), bands([[224, 90, 58], [0, 112, 243]]));
    await fs.writeFile(path.join(root, 'assets', 'legacy.jpg'), Buffer.from([0xff, 0xd8, 0xff]));

    const result = await inspectBrandColors({ root, assets: 'assets' });

    assert.equal(result.theme.colors.length, 2);
    assert.ok(result.theme.colors.some((color) => color.name === '--background' && color.contrastWithBackground === 1));
    assert.equal(result.assets.length, 1);
    assert.ok(result.assets[0].palette.some((entry) => entry.matched), 'the primary color should match a token');
    assert.ok(result.warnings.some((warning) => /no theme token/.test(warning)), 'the unmatched brand color should warn');
    assert.ok(result.warnings.some((warning) => /not a PNG/.test(warning)));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
