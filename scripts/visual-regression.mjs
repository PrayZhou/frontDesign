#!/usr/bin/env node
import { parseArgs, printJson } from './lib/cli.mjs';
import { compareCaptures, updateBaseline } from './lib/visual-regression.mjs';

const help = `Usage:
  visual-regression.mjs --baseline <dir> --current <dir> [--threshold 0.02] [--tolerance 12] [--json]
  visual-regression.mjs --baseline <dir> --current <dir> --update

  --threshold <ratio>   failure above this share of changed pixels (default 0.02 = 2%)
  --tolerance <0-255>   per-channel delta ignored as noise (default 12)
  --update              copy current captures into the baseline (after an approved review)
`;

const percent = (ratio) => `${(ratio * 100).toFixed(2)}%`;

try {
  const options = parseArgs(process.argv.slice(2), {
    baseline: { type: 'string', default: 'qa/baseline' },
    current: { type: 'string', default: 'qa' },
    threshold: { type: 'string', default: '0.02' },
    tolerance: { type: 'string', default: '12' },
    update: { type: 'boolean' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  });

  if (options.help) {
    process.stdout.write(help);
  } else if (options.update) {
    const result = await updateBaseline({ baseline: options.baseline, current: options.current });
    if (options.json) printJson(result);
    else {
      process.stdout.write(`Updated ${result.updated} baseline capture(s) in ${options.baseline}.\n`);
      for (const file of result.stale) process.stdout.write(`stale baseline (not deleted): ${file}\n`);
    }
  } else {
    const threshold = Number(options.threshold);
    const tolerance = Number(options.tolerance);
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
      throw new Error('Option --threshold must be a ratio between 0 and 1.');
    }
    if (!Number.isFinite(tolerance) || tolerance < 0 || tolerance > 255) {
      throw new Error('Option --tolerance must be between 0 and 255.');
    }

    const report = await compareCaptures({
      baseline: options.baseline,
      current: options.current,
      threshold,
      tolerance,
    });

    if (report.summary.total === 0) {
      throw new Error(`No baseline captures found in ${options.baseline}. Run with --update after an approved review.`);
    }

    if (options.json) {
      printJson(report);
    } else {
      for (const item of report.files) {
        if (item.status === 'pass' || item.status === 'fail') {
          const measure = item.sizeChanged
            ? `size ${item.baselineSize.width}x${item.baselineSize.height} -> ${item.currentSize.width}x${item.currentSize.height}`
            : percent(item.ratio);
          const bbox = item.bbox
            ? `bbox ${item.bbox.x},${item.bbox.y} ${item.bbox.width}x${item.bbox.height}`
            : 'no pixel changes';
          process.stdout.write(`${item.status.padEnd(7)} ${measure.padStart(10)}  ${item.file.padEnd(36)} ${bbox}  hashΔ ${item.hashDistance}\n`);
        } else if (item.status === 'missing') {
          process.stdout.write(`missing              ${item.file} (baseline capture has no current counterpart)\n`);
        } else {
          process.stdout.write(`new                  ${item.file} (no baseline yet)\n`);
        }
      }
      const { passed, failed, missing, added } = report.summary;
      process.stdout.write(`\n${passed} passed, ${failed} failed, ${missing} missing, ${added} new (threshold ${percent(threshold)})\n`);
    }

    if (report.summary.failed > 0 || report.summary.missing > 0) process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
