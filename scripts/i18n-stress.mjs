#!/usr/bin/env node
import { parseArgs, printJson } from './lib/cli.mjs';
import { analyzeLocales, pseudoLocale } from './lib/i18n-stress.mjs';
import { loadLocales } from './lib/locale-files.mjs';

const help = `Usage:
  i18n-stress.mjs --dir locales [--baseline en] [--max-expansion 1.6] [--warn-expansion 1.3] [--pseudo] [--json]

  Checks missing keys, placeholder parity, empty values, and text expansion against a
  baseline locale. Reads <locale>.json and <locale>/<namespace>.json (including subdirectories).
  --pseudo prints a pseudo-localized baseline map for injection.
`;

try {
  const options = parseArgs(process.argv.slice(2), {
    dir: { type: 'string', default: 'locales' },
    baseline: { type: 'string' },
    'max-expansion': { type: 'string', default: '1.6' },
    'warn-expansion': { type: 'string', default: '1.3' },
    pseudo: { type: 'boolean' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  });

  if (options.help) {
    process.stdout.write(help);
  } else {
    const maxExpansion = Number(options['max-expansion']);
    const warnExpansion = Number(options['warn-expansion']);
    if (!Number.isFinite(maxExpansion) || maxExpansion < 1 || maxExpansion > 5) {
      throw new Error('Option --max-expansion must be between 1 and 5.');
    }
    if (!Number.isFinite(warnExpansion) || warnExpansion < 1 || warnExpansion > maxExpansion) {
      throw new Error('Option --warn-expansion must be between 1 and --max-expansion.');
    }

    const { locales, errors } = await loadLocales(options.dir);
    if (errors.length) throw new Error(errors.join('\n'));
    if (!Object.keys(locales).length) throw new Error(`No locale JSON files found in ${options.dir}.`);

    const result = analyzeLocales(locales, {
      baseline: options.baseline,
      maxExpansion,
      warnExpansion,
    });

    if (options.pseudo) {
      const baselineMessages = locales[result.baseline];
      printJson(pseudoLocale(baselineMessages, warnExpansion));
    } else if (options.json) {
      printJson(result);
    } else {
      process.stdout.write(`Baseline: ${result.baseline} (${result.locales.length} locale(s))\n`);
      for (const locale of result.locales) {
        if (locale.isBaseline) {
          process.stdout.write(`  ${locale.name.padEnd(6)} baseline, ${locale.keyCount} keys\n`);
        } else {
          const expansion = locale.expansion;
          process.stdout.write(
            `  ${locale.name.padEnd(6)} ${String(locale.keyCount).padStart(3)} keys, ${locale.missing} missing, ${locale.extra} extra, max expansion ${expansion.max}x${expansion.worstKey ? ` (${expansion.worstKey})` : ''}\n`,
          );
        }
      }
      if (result.issues.length) {
        process.stdout.write('\nIssues:\n');
        for (const issue of result.issues) {
          process.stdout.write(`  ${issue.severity.padEnd(7)} ${issue.code.padEnd(20)} ${issue.locale}.${issue.key}: ${issue.message}\n`);
        }
      }
      process.stdout.write(`\n${result.summary.errors} error(s), ${result.summary.warnings} warning(s)\n`);
    }

    // --pseudo is a generator, not a check: it must not fail because the input has issues.
    if (!options.pseudo && result.summary.errors > 0) process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
