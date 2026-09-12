#!/usr/bin/env node
import { parseArgs, printJson } from './lib/cli.mjs';
import { buildOnlineSourceResult, queryProject, queryRegistryFile } from './lib/component-query.mjs';

const help = 'Usage: query-components.mjs --source <project|registry-file|shadcn|magicui|aceternity> --query <text> [--root <path>] [--registry-file <path>] [--json] [--help]\n';

try {
  const argumentSchema = {
    source: { type: 'string', required: true },
    query: { type: 'string', required: true },
    root: { type: 'string', default: '.' },
    'registry-file': { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  };
  const argv = process.argv.slice(2);
  if (argv.includes('--help')) {
    process.stdout.write(help);
  } else {
    const options = parseArgs(argv, argumentSchema);
    const query = options.query;
    const source = options.source;
    if (source === 'registry-file' && !options['registry-file']) {
      throw new Error('Option --registry-file is required when --source is registry-file.');
    }
    const output = source === 'project'
      ? await queryProject(options.root, query)
      : source === 'registry-file'
        ? await queryRegistryFile(options['registry-file'], query, 'registry-file')
        : await buildOnlineSourceResult(source, query, options.root);
    if (options.json) printJson(output);
    else process.stdout.write(`${output.status}: ${output.candidates.length} candidates\n`);
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
