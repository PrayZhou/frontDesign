#!/usr/bin/env node
import { parseArgs, printJson } from './lib/cli.mjs';
import { readJsonFile } from './lib/project-inspector.mjs';
import { budgetsFromPlan, inspectBundle } from './lib/bundle-budget.mjs';

const help = `Usage:
  bundle-budget.mjs --root <project> [--plan <plan.json>] [--budget-route 250] [--budget-css 80] [--budget-js 1200] [--top 8] [--json]

  Measures the production build (Next app/pages manifest, or a static asset directory) and
  fails when a route's first-load JS or the shipped CSS exceeds its gzip budget (KB = 1024 B).
  Budgets declared in designIntent.performanceBudget override the defaults when --plan is given.
`;

const numberOption = (value, label, { min = 0, max = 100000 } = {}) => {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`Option ${label} must be a number between ${min} and ${max}.`);
  }
  return parsed;
};

try {
  const options = parseArgs(process.argv.slice(2), {
    root: { type: 'string', default: '.' },
    plan: { type: 'string' },
    'budget-route': { type: 'string' },
    'budget-css': { type: 'string' },
    'budget-js': { type: 'string' },
    top: { type: 'string', default: '8' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  });

  if (options.help) {
    process.stdout.write(help);
  } else {
    const planBudgets = options.plan ? budgetsFromPlan(await readJsonFile(options.plan)) : {};
    const budgets = {
      routeKb: numberOption(options['budget-route'], '--budget-route') ?? planBudgets.routeKb ?? 250,
      cssKb: numberOption(options['budget-css'], '--budget-css') ?? planBudgets.cssKb ?? 80,
      jsKb: numberOption(options['budget-js'], '--budget-js') ?? null,
    };
    const top = Math.round(numberOption(options.top, '--top', { min: 1, max: 50 }) ?? 8);

    const report = await inspectBundle({ root: options.root, budgets, top });

    if (!report.source) {
      throw new Error(report.warnings[0]);
    }

    if (options.json) {
      printJson(report);
    } else {
      process.stdout.write(`Build output: ${report.source} (${report.buildDirectory})\n`);
      if (report.routes.length) {
        process.stdout.write('\nRoutes by first-load JS (gzip):\n');
        for (const route of report.routes.slice(0, 12)) {
          process.stdout.write(
            `  ${route.route.padEnd(34)} JS ${String(route.jsKb).padStart(7)} KB  CSS ${String(route.cssKb).padStart(5)} KB  ${route.chunks} chunk(s)\n`,
          );
        }
      }
      process.stdout.write(`\nShipped JS ${report.totals.js.gzipKb} KB gzip / ${report.totals.js.rawKb} KB raw (${report.totals.js.files} files)\n`);
      process.stdout.write(`Shipped CSS ${report.totals.css.gzipKb} KB gzip / ${report.totals.css.rawKb} KB raw (${report.totals.css.files} files)\n`);

      if (report.largest.length) {
        process.stdout.write('\nLargest assets (gzip):\n');
        for (const asset of report.largest) {
          process.stdout.write(`  ${asset.gzipKb.toString().padStart(7)} KB  ${asset.kind.padEnd(3)}  ${asset.file}\n`);
        }
      }

      process.stdout.write(`\nBudgets: route ${budgets.routeKb} KB, CSS ${budgets.cssKb} KB${budgets.jsKb ? `, JS ${budgets.jsKb} KB` : ''}\n`);
      for (const violation of report.violations) {
        process.stdout.write(`  FAIL ${violation.code}: ${violation.target} is ${violation.actualKb} KB, budget ${violation.limitKb} KB\n`);
      }
      if (report.violations.length === 0) process.stdout.write('  All budgets met.\n');

      for (const warning of report.warnings) process.stdout.write(`  warning: ${warning}\n`);
    }

    if (report.violations.length > 0) process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
