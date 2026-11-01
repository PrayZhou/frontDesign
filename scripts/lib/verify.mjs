import { promises as fs } from 'node:fs';
import path from 'node:path';
import { budgetsFromPlan, inspectBundle } from './bundle-budget.mjs';
import { listFiles } from './files.mjs';
import { analyzeLocales, flattenMessages } from './i18n-stress.mjs';
import { validateComponentPlan } from './plan-validator.mjs';
import { inspectProject } from './project-inspector.mjs';
import { compareCaptures } from './visual-regression.mjs';

async function loadLocales(root, directory) {
  const files = await listFiles(path.join(root, directory), { extensions: ['.json'] });
  const locales = {};
  const errors = [];
  for (const file of files) {
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(root, directory, file), 'utf8'));
      locales[path.posix.basename(file, '.json')] = flattenMessages(parsed);
    } catch (error) {
      errors.push(`${file}: ${error.message}`);
    }
  }
  return { locales, errors };
}

// One close-out command; absent inputs are skipped, never reported as passes.
export async function verifyProject({
  plan,
  root = '.',
  qa = 'qa',
  baseline = 'qa/baseline',
  locales = 'locales',
  skip = [],
} = {}) {
  const skipped = new Set(skip);
  const checks = [];
  const resolvedRoot = path.resolve(root);

  if (!skipped.has('plan')) {
    const project = await inspectProject(resolvedRoot);
    const result = validateComponentPlan(plan, { project });
    checks.push({
      id: 'plan',
      status: result.valid ? (result.warnings.length ? 'warn' : 'pass') : 'fail',
      summary: result.summary,
      errors: result.errors,
      warnings: result.warnings,
    });
  }

  if (!skipped.has('bundle')) {
    const bundle = await inspectBundle({ root: resolvedRoot, budgets: budgetsFromPlan(plan) });
    checks.push(bundle.source
      ? {
        id: 'bundle',
        status: bundle.violations.length ? 'fail' : 'pass',
        source: bundle.source,
        routes: bundle.routes.length,
        largestRouteKb: bundle.routes[0]?.jsKb ?? null,
        violations: bundle.violations,
        warnings: bundle.warnings,
      }
      : { id: 'bundle', status: 'skipped', reason: 'no production build output found' });
  }

  if (!skipped.has('i18n')) {
    const { locales: messages, errors: parseErrors } = await loadLocales(resolvedRoot, locales);
    if (Object.keys(messages).length === 0 && parseErrors.length === 0) {
      checks.push({ id: 'i18n', status: 'skipped', reason: `no locale JSON under ${locales}` });
    } else {
      const result = Object.keys(messages).length
        ? analyzeLocales(messages, {})
        : { baseline: null, summary: { errors: 0, warnings: 0 }, issues: [] };
      checks.push({
        id: 'i18n',
        status: parseErrors.length || result.summary.errors
          ? 'fail'
          : (result.summary.warnings ? 'warn' : 'pass'),
        baseline: result.baseline,
        summary: result.summary,
        issues: result.issues,
        parseErrors,
      });
    }
  }

  if (!skipped.has('regression')) {
    const report = await compareCaptures({
      baseline: path.join(resolvedRoot, baseline),
      current: path.join(resolvedRoot, qa),
    });
    if (report.summary.total === 0) {
      checks.push({ id: 'regression', status: 'skipped', reason: `no baseline captures in ${baseline}` });
    } else {
      checks.push({
        id: 'regression',
        status: report.summary.failed > 0 || report.summary.missing > 0 ? 'fail' : 'pass',
        summary: report.summary,
        failures: report.files.filter((file) => file.status === 'fail' || file.status === 'missing'),
      });
    }
  }

  const summary = { pass: 0, warn: 0, fail: 0, skipped: 0 };
  for (const check of checks) summary[check.status] += 1;

  return { root: resolvedRoot, checks, summary, ok: summary.fail === 0 };
}
