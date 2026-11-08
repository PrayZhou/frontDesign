import { promises as fs } from 'node:fs';
import path from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { listFiles } from './files.mjs';

const KB = 1024;
const JS_EXTENSIONS = ['.js', '.mjs', '.cjs'];
const CSS_EXTENSIONS = ['.css'];
const ASSET_EXTENSIONS = [...JS_EXTENSIONS, ...CSS_EXTENSIONS];

const toKb = (bytes) => Number((bytes / KB).toFixed(1));

export function measureBuffer(buffer) {
  return {
    rawBytes: buffer.length,
    gzipBytes: gzipSync(buffer, { level: 9 }).length,
    brotliBytes: brotliCompressSync(buffer).length,
  };
}

function kindOf(file) {
  const lower = file.toLowerCase();
  if (lower.endsWith('.css')) return 'css';
  if (JS_EXTENSIONS.some((extension) => lower.endsWith(extension))) return 'js';
  return null;
}

async function readJson(file) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function isDirectory(directory) {
  try {
    return (await fs.stat(directory)).isDirectory();
  } catch {
    return false;
  }
}

async function detectSource(root) {
  const appManifest = await readJson(path.join(root, '.next', 'app-build-manifest.json'));
  if (appManifest) {
    return {
      source: 'next-app',
      buildDirectory: '.next',
      assetDirectory: path.join(root, '.next', 'static'),
      manifest: appManifest,
    };
  }

  const pagesManifest = await readJson(path.join(root, '.next', 'build-manifest.json'));
  if (pagesManifest) {
    return {
      source: 'next-pages',
      buildDirectory: '.next',
      assetDirectory: path.join(root, '.next', 'static'),
      manifest: pagesManifest,
    };
  }

  for (const directory of ['dist/assets', 'build/static', 'out/_next/static', '.next/static']) {
    const absolute = path.join(root, directory);
    if (await isDirectory(absolute)) {
      return { source: 'directory', buildDirectory: directory, assetDirectory: absolute, manifest: null };
    }
  }

  return null;
}

// Next manifests list `static/chunks/...` while the assets live under `.next/static`.
function assetKey(source, file) {
  const normalized = file.replace(/\\/g, '/');
  if (source === 'next-app' || source === 'next-pages') return normalized.replace(/^static\//, '');
  return normalized;
}

function routeEntries(source, manifest) {
  if (!manifest || typeof manifest !== 'object') return [];
  const pages = manifest.pages && typeof manifest.pages === 'object' ? manifest.pages : {};
  return Object.entries(pages)
    .filter(([route]) => !route.startsWith('/_'))
    .map(([route, files]) => ({
      route,
      files: (Array.isArray(files) ? files : []).filter((file) => ASSET_EXTENSIONS.some((extension) => file.toLowerCase().endsWith(extension))),
    }));
}

async function measureAssets(source, assetDirectory) {
  const metrics = new Map();
  if (!(await isDirectory(assetDirectory))) return metrics;

  const files = await listFiles(assetDirectory, { extensions: ASSET_EXTENSIONS });
  for (const file of files) {
    const kind = kindOf(file);
    if (!kind) continue;
    try {
      const buffer = await fs.readFile(path.join(assetDirectory, file));
      metrics.set(assetKey(source, file), { file: assetKey(source, file), kind, ...measureBuffer(buffer) });
    } catch {
      // A file that disappears between listing and reading is simply not measured.
    }
  }
  return metrics;
}

function sumByKind(entries, kind, field) {
  return entries
    .filter((entry) => entry.kind === kind)
    .reduce((total, entry) => total + entry[field], 0);
}

export async function inspectBundle({ root = '.', budgets = {}, top = 8 } = {}) {
  const resolvedRoot = path.resolve(root);
  const detected = await detectSource(resolvedRoot);

  if (!detected) {
    return {
      root: resolvedRoot,
      source: null,
      buildDirectory: null,
      routes: [],
      totals: { js: null, css: null },
      largest: [],
      budgets,
      missingAssets: [],
      violations: [],
      warnings: ['No production build output found. Run the production build before measuring.'],
    };
  }

  const assets = await measureAssets(detected.source, detected.assetDirectory);
  const allAssets = [...assets.values()];
  const warnings = [];
  const missingAssets = new Set();

  const routes = routeEntries(detected.source, detected.manifest).map((entry) => {
    const resolved = [];
    for (const file of entry.files) {
      const key = assetKey(detected.source, file);
      const asset = assets.get(key);
      if (!asset) {
        missingAssets.add(key);
        warnings.push(`Route ${entry.route} references a missing asset: ${key}`);
        continue;
      }
      resolved.push(asset);
    }
    const js = resolved.filter((asset) => asset.kind === 'js');
    const css = resolved.filter((asset) => asset.kind === 'css');
    return {
      route: entry.route,
      chunks: js.length,
      jsKb: toKb(sumByKind(resolved, 'js', 'gzipBytes')),
      cssKb: toKb(sumByKind(resolved, 'css', 'gzipBytes')),
      rawKb: toKb(resolved.reduce((total, asset) => total + asset.rawBytes, 0)),
      gzipKb: toKb(resolved.reduce((total, asset) => total + asset.gzipBytes, 0)),
      brotliKb: toKb(resolved.reduce((total, asset) => total + asset.brotliBytes, 0)),
    };
  }).sort((left, right) => right.jsKb - left.jsKb || left.route.localeCompare(right.route));

  const totals = {
    js: {
      files: allAssets.filter((asset) => asset.kind === 'js').length,
      rawKb: toKb(sumByKind(allAssets, 'js', 'rawBytes')),
      gzipKb: toKb(sumByKind(allAssets, 'js', 'gzipBytes')),
      brotliKb: toKb(sumByKind(allAssets, 'js', 'brotliBytes')),
    },
    css: {
      files: allAssets.filter((asset) => asset.kind === 'css').length,
      rawKb: toKb(sumByKind(allAssets, 'css', 'rawBytes')),
      gzipKb: toKb(sumByKind(allAssets, 'css', 'gzipBytes')),
      brotliKb: toKb(sumByKind(allAssets, 'css', 'brotliBytes')),
    },
  };

  const largest = allAssets
    .slice()
    .sort((left, right) => right.gzipBytes - left.gzipBytes)
    .slice(0, top)
    .map((asset) => ({ file: asset.file, kind: asset.kind, gzipKb: toKb(asset.gzipBytes), rawKb: toKb(asset.rawBytes) }));

  const violations = [];
  for (const route of routes) {
    if (budgets.routeKb && route.jsKb > budgets.routeKb) {
      violations.push({ code: 'route-js-budget', target: route.route, actualKb: route.jsKb, limitKb: budgets.routeKb });
    }
  }
  if (budgets.cssKb && totals.css.gzipKb > budgets.cssKb) {
    violations.push({ code: 'css-budget', target: 'all css', actualKb: totals.css.gzipKb, limitKb: budgets.cssKb });
  }
  if (budgets.jsKb && totals.js.gzipKb > budgets.jsKb) {
    violations.push({ code: 'js-budget', target: 'all js', actualKb: totals.js.gzipKb, limitKb: budgets.jsKb });
  }

  if (detected.source === 'next-pages' && routes.length === 0) {
    warnings.push('The pages manifest had no client entries; check that the build ran in production mode.');
  }

  // Next manifests list JS chunks per route but not the CSS files, so a per-route CSS number
  // would read as zero and hide the real shipped CSS.
  if ((detected.source === 'next-app' || detected.source === 'next-pages') && routes.length > 0 && totals.css.files > 0) {
    warnings.push('The Next manifest does not attribute CSS per route; the CSS budget applies to the shipped total.');
  }

  return {
    root: resolvedRoot,
    source: detected.source,
    buildDirectory: detected.buildDirectory,
    routes,
    totals,
    largest,
    budgets,
    missingAssets: [...missingAssets].sort(),
    violations,
    warnings,
  };
}

export function budgetsFromPlan(plan) {
  const performance = plan?.designIntent?.performanceBudget;
  if (!performance || typeof performance !== 'object') return {};
  return {
    routeKb: Number.isFinite(performance.maxFirstLoadKb) ? performance.maxFirstLoadKb : undefined,
    cssKb: Number.isFinite(performance.maxCssKb) ? performance.maxCssKb : undefined,
  };
}
