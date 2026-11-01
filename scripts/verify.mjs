#!/usr/bin/env node
import { parseArgs, printJson } from './lib/cli.mjs';
import { readJsonFile } from './lib/project-inspector.mjs';
import { verifyProject } from './lib/verify.mjs';

const help = `Usage:
  verify.mjs --plan <plan.json> [--root .] [--qa qa] [--baseline qa/baseline] [--locales locales] [--skip bundle,i18n] [--json]

  Runs the close-out checks in one pass: plan validation against the project, then build
  budget, localization pressure, and visual regression. A check whose input is absent is
  reported as skipped, never as a pass. Exit 1 when any check fails.
`;

const CHECKS = new Set(['plan', 'bundle', 'i18n', 'regression']);

try {
  const options = parseArgs(process.argv.slice(2), {
    plan: { type: 'string' },
    root: { type: 'string', default: '.' },
    qa: { type: 'string', default: 'qa' },
    baseline: { type: 'string', default: 'qa/baseline' },
    locales: { type: 'string', default: 'locales' },
    skip: { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  });

  if (options.help) {
    process.stdout.write(help);
  } else if (!options.plan) {
    throw new Error('Option --plan is required');
  } else {
    const skip = options.skip ? options.skip.split(',').map((value) => value.trim()).filter(Boolean) : [];
    for (const id of skip) {
      if (!CHECKS.has(id)) throw new Error(`Unknown --skip value: ${id}. Use ${[...CHECKS].join(', ')}.`);
    }

    const report = await verifyProject({
      plan: await readJsonFile(options.plan),
      root: options.root,
      qa: options.qa,
      baseline: options.baseline,
      locales: options.locales,
      skip,
    });

    if (options.json) {
      printJson(report);
    } else {
      const { pass, warn, fail, skipped } = report.summary;
      process.stdout.write(`verify — ${fail} fail, ${warn} warn, ${pass} pass, ${skipped} skipped\n\n`);

      for (const check of report.checks) {
        if (check.status === 'skipped') {
          process.stdout.write(`skip  ${check.id.padEnd(11)} ${check.reason}\n`);
          continue;
        }
        const label = `${check.status.padEnd(5)} ${check.id.padEnd(11)}`;
        if (check.id === 'plan') {
          process.stdout.write(`${label} ${check.summary.regionCount} region(s), ${check.summary.errorCount} error(s), ${check.summary.warningCount} warning(s)\n`);
          for (const item of [...check.errors, ...check.warnings].slice(0, 6)) {
            process.stdout.write(`        ${item.code} ${item.path}\n`);
          }
        } else if (check.id === 'bundle') {
          const largest = check.largestRouteKb === null ? 'n/a' : `${check.largestRouteKb} KB`;
          process.stdout.write(`${label} ${check.source}, ${check.routes} route(s), largest route ${largest}\n`);
          for (const violation of check.violations) {
            process.stdout.write(`        ${violation.code}: ${violation.target} is ${violation.actualKb} KB, budget ${violation.limitKb} KB\n`);
          }
        } else if (check.id === 'i18n') {
          process.stdout.write(`${label} baseline ${check.baseline ?? 'none'}, ${check.summary.errors} error(s), ${check.summary.warnings} warning(s)\n`);
          for (const issue of check.issues.slice(0, 4)) {
            process.stdout.write(`        ${issue.code} ${issue.locale}.${issue.key}\n`);
          }
          for (const error of check.parseErrors.slice(0, 4)) {
            process.stdout.write(`        invalid-json ${error}\n`);
          }
        } else if (check.id === 'regression') {
          process.stdout.write(`${label} ${check.summary.passed} passed, ${check.summary.failed} failed, ${check.summary.missing} missing\n`);
          for (const failure of check.failures.slice(0, 4)) {
            process.stdout.write(`        ${failure.status}: ${failure.file}\n`);
          }
        }
      }

      process.stdout.write(`\n${report.ok ? 'Close-out checks passed.' : 'Close-out checks failed.'}\n`);
    }

    if (!report.ok) process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
