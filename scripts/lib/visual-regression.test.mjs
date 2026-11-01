import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from './png.mjs';
import { compareImages, differenceHash, hammingDistance } from './image-diff.mjs';
import { compareCaptures, updateBaseline } from './visual-regression.mjs';
import { encodePng } from './png-fixture.mjs';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'visual-regression.mjs');

const solid = (color) => encodePng(8, 8, () => color);
const half = (left, right) => encodePng(8, 8, (x) => (x < 4 ? left : right));

async function tempDirs() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cdf-vr-'));
  return { root, baseline: path.join(root, 'baseline'), current: path.join(root, 'current') };
}

test('decodes RGBA and RGB PNGs', () => {
  const rgba = decodePng(solid([10, 20, 30, 255]));
  assert.equal(rgba.width, 8);
  assert.equal(rgba.height, 8);
  assert.deepEqual([...rgba.data.subarray(0, 4)], [10, 20, 30, 255]);

  const rgb = decodePng(encodePng(4, 2, () => [200, 100, 50], { colorType: 2 }));
  assert.deepEqual([...rgb.data.subarray(0, 4)], [200, 100, 50, 255]);
});

test('identical images compare clean', () => {
  const before = decodePng(solid([1, 2, 3]));
  const after = decodePng(solid([1, 2, 3]));
  const diff = compareImages(before, after);
  assert.equal(diff.ratio, 0);
  assert.equal(diff.changedPixels, 0);
  assert.equal(diff.hashDistance, 0);
  assert.equal(diff.bbox, null);
});

test('a changed half is measured with a bounding box', () => {
  const before = decodePng(half([255, 255, 255], [0, 0, 0]));
  const after = decodePng(half([255, 255, 255], [255, 0, 0]));
  const diff = compareImages(before, after, { tolerance: 12 });
  assert.equal(diff.sizeChanged, false);
  assert.ok(diff.ratio > 0.4 && diff.ratio < 0.6, `unexpected ratio ${diff.ratio}`);
  assert.deepEqual(diff.bbox, { x: 4, y: 0, width: 4, height: 8 });
});

test('a size change always fails', () => {
  const before = decodePng(encodePng(8, 8, () => [255, 255, 255]));
  const after = decodePng(encodePng(8, 9, () => [255, 255, 255]));
  const diff = compareImages(before, after);
  assert.equal(diff.sizeChanged, true);
  assert.equal(diff.ratio, 1);
});

test('difference hash tracks coarse structure', () => {
  const a = differenceHash(decodePng(solid([0, 0, 0])));
  const b = differenceHash(decodePng(solid([255, 255, 255])));
  assert.equal(hammingDistance(a, b), 0);
  const c = differenceHash(decodePng(half([0, 0, 0], [255, 255, 255])));
  assert.ok(hammingDistance(a, c) > 0);
});

test('captures compare by relative path', async () => {
  const { root, baseline, current } = await tempDirs();
  try {
    await fs.mkdir(baseline, { recursive: true });
    await fs.mkdir(current, { recursive: true });
    await fs.writeFile(path.join(baseline, 'desktop.png'), solid([255, 255, 255]));
    await fs.writeFile(path.join(current, 'desktop.png'), solid([255, 255, 255]));
    await fs.writeFile(path.join(baseline, 'mobile.png'), half([0, 0, 0], [0, 0, 0]));
    await fs.writeFile(path.join(current, 'mobile.png'), half([255, 255, 255], [255, 255, 255]));
    await fs.writeFile(path.join(baseline, 'missing.png'), solid([0, 0, 0]));
    await fs.writeFile(path.join(current, 'new.png'), solid([0, 0, 0]));

    const report = await compareCaptures({ baseline, current, threshold: 0.02, tolerance: 12 });
    const byFile = Object.fromEntries(report.files.map((item) => [item.file, item.status]));
    assert.equal(byFile['desktop.png'], 'pass');
    assert.equal(byFile['mobile.png'], 'fail');
    assert.equal(byFile['missing.png'], 'missing');
    assert.equal(byFile['new.png'], 'new');
    assert.deepEqual(report.summary, { total: 3, passed: 1, failed: 1, missing: 1, added: 1 });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('--update copies captures and reports stale baselines', async () => {
  const { root, baseline, current } = await tempDirs();
  try {
    await fs.mkdir(path.join(current, 'desktop'), { recursive: true });
    await fs.mkdir(path.join(baseline, 'old'), { recursive: true });
    await fs.writeFile(path.join(current, 'desktop', 'home.png'), solid([1, 1, 1]));
    await fs.writeFile(path.join(baseline, 'old', 'stale.png'), solid([2, 2, 2]));

    const result = await updateBaseline({ baseline, current });
    assert.equal(result.updated, 1);
    assert.deepEqual(result.stale, ['old/stale.png']);
    const copied = await fs.readFile(path.join(baseline, 'desktop', 'home.png'));
    assert.equal(copied.length, solid([1, 1, 1]).length);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('a baseline nested inside the capture directory is not treated as a capture', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cdf-vr-nested-'));
  const current = path.join(root, 'qa');
  const baseline = path.join(current, 'baseline');
  try {
    await fs.mkdir(baseline, { recursive: true });
    await fs.writeFile(path.join(baseline, 'home.png'), solid([0, 0, 0]));
    await fs.writeFile(path.join(current, 'home.png'), solid([0, 0, 0]));

    const report = await compareCaptures({ baseline, current });
    assert.deepEqual(report.files.map((item) => `${item.status}:${item.file}`), ['pass:home.png']);

    await fs.writeFile(path.join(current, 'new.png'), solid([9, 9, 9]));
    const updated = await updateBaseline({ baseline, current });
    assert.equal(updated.updated, 2);
    await assert.rejects(fs.access(path.join(baseline, 'baseline')), 'must not nest a second baseline');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('the CLI exits 1 on a regression and 2 without a baseline', async () => {
  const { root, baseline, current } = await tempDirs();
  try {
    await fs.mkdir(baseline, { recursive: true });
    await fs.mkdir(current, { recursive: true });
    await fs.writeFile(path.join(baseline, 'home.png'), solid([0, 0, 0]));
    await fs.writeFile(path.join(current, 'home.png'), solid([255, 255, 255]));

    await assert.rejects(
      run(process.execPath, [cli, '--baseline', baseline, '--current', current, '--json']),
      (error) => {
        assert.equal(error.code, 1);
        const report = JSON.parse(error.stdout);
        assert.equal(report.summary.failed, 1);
        assert.equal(report.files[0].hashDistance, 0);
        return true;
      },
    );

    await assert.rejects(
      run(process.execPath, [cli, '--baseline', path.join(root, 'nope'), '--current', current]),
      (error) => error.code === 2 && /No baseline captures/.test(error.stderr),
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
