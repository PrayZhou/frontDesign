import { promises as fs } from 'node:fs';
import path from 'node:path';
import { listFiles } from './files.mjs';
import { compareImages } from './image-diff.mjs';
import { decodePng } from './png.mjs';

const PNG = ['.png'];

async function readPng(root, file) {
  return decodePng(await fs.readFile(path.join(root, file)));
}

// The default layout keeps the baseline inside the capture directory (qa/baseline under qa).
// Without this exclusion the baseline files would be re-read as brand-new captures.
function baselinePrefix(current, baseline) {
  const relative = path.relative(path.resolve(current), path.resolve(baseline));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return `${relative.split(path.sep).join('/').replace(/\/+$/, '')}/`;
}

async function captureFiles(root, { excludePrefix = null } = {}) {
  const files = await listFiles(root, { extensions: PNG });
  if (!excludePrefix) return files;
  return files.filter((file) => !file.startsWith(excludePrefix));
}

// Compares every capture pair by path. Size changes always fail: a different canvas means
// the page moved, which a pixel ratio alone would understate.
export async function compareCaptures({ baseline, current, threshold = 0.02, tolerance = 12 }) {
  const excludePrefix = baselinePrefix(current, baseline);
  const baselineFiles = await captureFiles(baseline);
  const currentFiles = await captureFiles(current, { excludePrefix });
  const currentSet = new Set(currentFiles);
  const baselineSet = new Set(baselineFiles);
  const results = [];

  for (const file of baselineFiles) {
    if (!currentSet.has(file)) {
      results.push({ file, status: 'missing' });
      continue;
    }
    const [before, after] = await Promise.all([
      readPng(baseline, file),
      readPng(current, file),
    ]);
    const diff = compareImages(before, after, { tolerance });
    const pass = !diff.sizeChanged && diff.ratio <= threshold;
    results.push({ file, status: pass ? 'pass' : 'fail', ...diff });
  }

  for (const file of currentFiles) {
    if (!baselineSet.has(file)) results.push({ file, status: 'new' });
  }

  return {
    baseline,
    current,
    threshold,
    tolerance,
    files: results,
    summary: {
      total: baselineFiles.length,
      passed: results.filter((item) => item.status === 'pass').length,
      failed: results.filter((item) => item.status === 'fail').length,
      missing: results.filter((item) => item.status === 'missing').length,
      added: results.filter((item) => item.status === 'new').length,
    },
  };
}

// Copies the current captures over the baseline. Extra baseline files are reported, never
// deleted: removing a reference image is a decision the user should make explicitly.
export async function updateBaseline({ baseline, current }) {
  const excludePrefix = baselinePrefix(current, baseline);
  const currentFiles = await captureFiles(current, { excludePrefix });
  if (currentFiles.length === 0) {
    throw new Error(`No PNG captures found in ${current}. Run the Playwright spec first.`);
  }
  const baselineFiles = new Set(await captureFiles(baseline));

  for (const file of currentFiles) {
    const destination = path.join(baseline, file);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(path.join(current, file), destination);
  }

  return {
    updated: currentFiles.length,
    stale: [...baselineFiles].filter((file) => !currentFiles.includes(file)).sort(),
  };
}
