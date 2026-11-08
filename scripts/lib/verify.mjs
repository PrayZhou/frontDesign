import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { budgetsFromPlan, inspectBundle } from './bundle-budget.mjs';
import { loadLocales } from './locale-files.mjs';
import { analyzeLocales } from './i18n-stress.mjs';
import { validateComponentPlan } from './plan-validator.mjs';
import { inspectProject } from './project-inspector.mjs';
import { compareCaptures } from './visual-regression.mjs';

const checkIds = ['plan', 'bundle', 'i18n', 'regression'];

function checkSet(option, ids) {
  if (!Array.isArray(ids)) throw new Error(`--${option} expects a list of check names.`);
  for (const id of ids) {
    if (!checkIds.includes(id)) {
      throw new Error(`Unknown --${option} value: ${JSON.stringify(id)}. Use ${checkIds.join(', ')}.`);
    }
  }
  return new Set(ids);
}

async function captureDirectory(root, directory) {
  const absolute = path.resolve(root, directory);
  try {
    return await realpath(absolute);
  } catch (error) {
    if (error.code === 'ENOENT') return absolute;
    throw error;
  }
}

export async function verifyProject({
  plan,
  root = '.',
  qa = 'qa',
  baseline = 'qa/baseline',
  locales = 'locales',
  skip = [],
  require: requiredIds = [],
} = {}) {
  const skipped = checkSet('skip', skip);
  const required = checkSet('require', requiredIds);
  for (const id of required) {
    if (skipped.has(id)) throw new Error(`Check "${id}" appears in both --require and --skip.`);
  }
  function missingInput(id, reason) {
    return required.has(id)
      ? { id, status: 'fail', code: 'required-input-missing', reason }
      : { id, status: 'skipped', reason };
  }
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
    if (!bundle.source) {
      checks.push(missingInput('bundle', 'no production build output found'));
    } else if (required.has('bundle') && bundle.missingAssets.length) {
      checks.push(missingInput('bundle', `missing build assets: ${bundle.missingAssets.join(', ')}`));
    } else if (bundle.totals.js.files + bundle.totals.css.files === 0) {
      checks.push(missingInput('bundle', `no measurable JS or CSS in ${bundle.buildDirectory}`));
    } else {
      checks.push({
        id: 'bundle',
        status: bundle.violations.length ? 'fail' : 'pass',
        source: bundle.source,
        routes: bundle.routes.length,
        largestRouteKb: bundle.routes[0]?.jsKb ?? null,
        violations: bundle.violations,
        warnings: bundle.warnings,
      });
    }
  }

  if (!skipped.has('i18n')) {
    const { locales: messages, errors: parseErrors } = await loadLocales(path.resolve(resolvedRoot, locales));
    const hasLocales = Object.keys(messages).length > 0;
    const result = hasLocales
      ? analyzeLocales(messages)
      : { baseline: null, issues: [], summary: { errors: 0, warnings: 0 } };
    if (!parseErrors.length && !hasLocales) {
      checks.push(missingInput('i18n', `no locale JSON under ${locales}`));
    } else if (required.has('i18n') && !parseErrors.length && !Object.keys(messages[result.baseline]).length) {
      checks.push(missingInput('i18n', `baseline locale ${result.baseline} contains no message keys`));
    } else {
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
    const [reference, current] = await Promise.all([
      captureDirectory(resolvedRoot, baseline),
      captureDirectory(resolvedRoot, qa),
    ]);
    if (required.has('regression') && reference === current) {
      throw new Error('--require regression needs different directories for --qa and --baseline.');
    }
    const report = await compareCaptures({ baseline: reference, current });
    if (report.summary.total === 0) {
      checks.push(missingInput('regression', `no baseline captures in ${baseline}`));
    } else {
      const failures = report.files.filter(file =>
        file.status === 'fail' || file.status === 'missing' || (required.has('regression') && file.status === 'new'));
      checks.push({
        id: 'regression',
        status: failures.length ? 'fail' : 'pass',
        summary: report.summary,
        failures,
      });
    }
  }

  const summary = { pass: 0, warn: 0, fail: 0, skipped: 0 };
  for (const check of checks) summary[check.status] += 1;

  return { root: resolvedRoot, checks, summary, ok: summary.fail === 0 };
}
