#!/usr/bin/env node
import { parseArgs, printJson } from './lib/cli.mjs';
import { inspectProject } from './lib/project-inspector.mjs';
import { checkContrast, deriveTokenPairs, resolveTokenPairs } from './lib/contrast.mjs';

const help = `Usage:
  check-contrast.mjs --root <project> --pairs 'foreground:background,muted-foreground:background' [--level AA|AAA] [--json]
  check-contrast.mjs --root <project> --list [--json]
  check-contrast.mjs --color '#111111:#ffffff' [--color '<fg>:<bg>'] [--level AA|AAA] [--json]
`;

const KIND_LABEL = { text: 'text', large: 'large text', ui: 'UI boundary' };

function formatRatio(ratio) {
  return ratio === null ? '  n/a' : `${ratio.toFixed(2)}:1`.padStart(7);
}

try {
  const options = parseArgs(process.argv.slice(2), {
    root: { type: 'string', default: '.' },
    pairs: { type: 'string' },
    color: { type: 'string', repeatable: true },
    list: { type: 'boolean' },
    level: { type: 'string', default: 'AA' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  });

  if (options.help) {
    process.stdout.write(help);
  } else {
    const specs = options.pairs
      ? options.pairs.split(',').map((spec) => spec.trim()).filter(Boolean)
      : [];
    const rawPairs = (options.color ?? []).map((spec) => {
      const separator = spec.lastIndexOf(':');
      if (separator <= 0) throw new Error(`Color pair must look like "<fg>:<bg>": ${spec}`);
      return {
        label: spec,
        foreground: spec.slice(0, separator),
        background: spec.slice(separator + 1),
        kind: 'text',
      };
    });

    if (!specs.length && !rawPairs.length && !options.list) {
      throw new Error("Provide --pairs, --color, or --list. Run with --help for usage.");
    }

    let project;
    if (specs.length || options.list) project = await inspectProject(options.root);
    const variables = project?.designTokens?.variables ?? [];

    if (options.list) {
      const derived = deriveTokenPairs(variables).map((pair) => ({
        foreground: pair.foreground,
        background: pair.background,
        kind: pair.kind,
        foregroundValue: pair.foregroundValue,
        backgroundValue: pair.backgroundValue,
      }));
      if (options.json) {
        printJson({ tokens: variables.length, pairs: derived });
      } else if (derived.length === 0) {
        process.stdout.write('No contrast pairs could be derived from the project theme tokens.\n');
      } else {
        for (const pair of derived) {
          process.stdout.write(`${pair.foreground} on ${pair.background}  (${pair.kind})  ${pair.foregroundValue} / ${pair.backgroundValue}\n`);
        }
      }
    } else {
      const tokenPairs = specs.length ? resolveTokenPairs(variables, specs) : [];
      const result = checkContrast([...tokenPairs, ...rawPairs], { level: options.level });

      if (options.json) {
        printJson(result);
      } else {
        for (const pair of result.pairs) {
          const status = pair.error ? 'ERROR' : pair.pass ? 'pass ' : 'FAIL ';
          const detail = pair.error
            ? pair.error
            : `${pair.foregroundHex} on ${pair.backgroundHex}`;
          process.stdout.write(`${status} ${formatRatio(pair.ratio)}  ${pair.label.padEnd(42)} ${KIND_LABEL[pair.kind]} >= ${pair.required}:1  ${detail}\n`);
        }
        process.stdout.write(`\n${result.summary.passed}/${result.summary.total} pairs meet ${result.level} thresholds.\n`);
      }

      if (result.summary.failed > 0) process.exitCode = 1;
    }
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
