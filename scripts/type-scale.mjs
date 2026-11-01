#!/usr/bin/env node
import { parseArgs, printJson } from './lib/cli.mjs';
import { buildTypeScale, renderTypeScaleMarkdown } from './lib/type-scale.mjs';

const help = `Usage:
  type-scale.mjs [--body 16] [--ratio 1.25] [--levels 6] [--format css|md|json] [--json]

  --body <px>     body font size, 8–32 (default 16)
  --ratio <n>     scale ratio, 1.05–1.8; 1.2 dense, 1.25 balanced, 1.333 editorial
  --levels <n>    number of steps, 3–8 (default 6: label … display)
  --format <fmt>  css (custom properties), md (table), or json
`;

const FORMATS = new Set(['css', 'md', 'json']);

try {
  const options = parseArgs(process.argv.slice(2), {
    body: { type: 'string' },
    ratio: { type: 'string' },
    levels: { type: 'string' },
    format: { type: 'string', default: 'md' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  });

  if (options.help) {
    process.stdout.write(help);
  } else {
    const format = options.json ? 'json' : options.format;
    if (!FORMATS.has(format)) throw new Error(`Option --format must be css, md, or json, received ${format}`);

    const scale = buildTypeScale({ base: options.body, ratio: options.ratio, levels: options.levels });
    if (format === 'json') printJson(scale);
    else if (format === 'css') process.stdout.write(`${scale.css}\n`);
    else process.stdout.write(renderTypeScaleMarkdown(scale));
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
