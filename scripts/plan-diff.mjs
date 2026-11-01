#!/usr/bin/env node
import { parseArgs, printJson } from './lib/cli.mjs';
import { readJsonFile } from './lib/project-inspector.mjs';
import { diffPlans, evaluateFailOn, FAIL_ON_FLAGS } from './lib/plan-diff.mjs';

const help = `Usage:
  plan-diff.mjs --before <plan.json> --after <plan.json> [--fail-on <areas>] [--json]

  --fail-on  comma list that blocks the run (exit 1) when those areas changed:
             ${[...Object.keys(FAIL_ON_FLAGS), 'any'].join(', ')}
`;

const short = (value) => {
  if (value === undefined) return 'undefined';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 70 ? `${text.slice(0, 67)}...` : text;
};

try {
  const options = parseArgs(process.argv.slice(2), {
    before: { type: 'string' },
    after: { type: 'string' },
    'fail-on': { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  });

  if (options.help) {
    process.stdout.write(help);
  } else if (!options.before || !options.after) {
    throw new Error('Options --before and --after are required');
  } else {
    const before = await readJsonFile(options.before);
    const after = await readJsonFile(options.after);
    const report = diffPlans(before, after);
    const failOn = options['fail-on']
      ? options['fail-on'].split(',').map((value) => value.trim()).filter(Boolean)
      : [];
    const blocked = evaluateFailOn(report.summary, failOn);

    if (options.json) {
      printJson({ ...report, failOn, blocked });
    } else {
      process.stdout.write(`Plan diff: ${report.counts.total} change(s) (${report.counts.added} added, ${report.counts.removed} removed, ${report.counts.changed} changed)\n\n`);
      if (report.changes.length === 0) {
        process.stdout.write('No structural changes.\n');
      }
      for (const change of report.changes) {
        if (change.type === 'added') {
          process.stdout.write(`+ ${change.path}  ${short(change.after)}\n`);
        } else if (change.type === 'removed') {
          process.stdout.write(`- ${change.path}  ${short(change.before)}\n`);
        } else {
          process.stdout.write(`~ ${change.path}: ${short(change.before)} -> ${short(change.after)}\n`);
        }
      }

      const summary = report.summary;
      const parts = [];
      if (summary.foundationChanged) parts.push('foundation');
      if (summary.enhancerChanged) parts.push('enhancer');
      if (summary.dependenciesChanged) parts.push('dependencies');
      if (summary.regionsChanged) parts.push(`regions (+${summary.addedRegions.length}/-${summary.removedRegions.length})`);
      if (summary.selectionChanged) parts.push('selection');
      if (summary.contrastPairsChanged) parts.push('contrastPairs');
      if (summary.successCriteriaChanged) parts.push('successCriteria');
      if (summary.styleDirectionChanged) parts.push('styleDirection');
      if (parts.length) process.stdout.write(`\nTouched: ${parts.join(', ')}\n`);

      if (blocked.length) process.stdout.write(`Blocked by --fail-on: ${blocked.join(', ')}\n`);
    }

    if (blocked.length) process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
