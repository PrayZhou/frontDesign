#!/usr/bin/env node
import { parseArgs, printJson } from './lib/cli.mjs';
import { inspectProject } from './lib/project-inspector.mjs';

const help = `Usage: inspect-project.mjs [--root <path>] [--json] [--help]\n`;

try {
  const options = parseArgs(process.argv.slice(2), {
    root: { type: 'string', default: '.' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  });
  if (options.help) {
    process.stdout.write(help);
  } else {
    const result = await inspectProject(options.root);
    if (options.json) printJson(result);
    else process.stdout.write(`${result.framework.primary ?? 'unknown'} project (${result.confidence} confidence)\n`);
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
