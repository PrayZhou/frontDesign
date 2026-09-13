#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { parseArgs, printJson } from './lib/cli.mjs';
import { readJsonFile } from './lib/project-inspector.mjs';
import { searchPlan, normalizeCaptured, auditPlan } from './lib/inspiration-planner.mjs';

const help = `Usage:
  inspiration-search.mjs --channel <inspiration|components> --brief <text> [--emotion <text>] [--intent <plan.json>] [--tiers T1,T2,T3] [--json]
  inspiration-search.mjs --normalize --input <captured.json> [--out <evidence.json>] [--json]
  inspiration-search.mjs --audit-plan <plan.json> [--json] [--help]
`;

try {
  const options = parseArgs(process.argv.slice(2), {
    channel: { type: 'string' },
    brief: { type: 'string' },
    emotion: { type: 'string' },
    intent: { type: 'string' },
    tiers: { type: 'string' },
    normalize: { type: 'boolean' },
    input: { type: 'string' },
    out: { type: 'string' },
    'audit-plan': { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  });

  if (options.help) {
    process.stdout.write(help);
  } else if (options['audit-plan']) {
    const result = auditPlan(await readJsonFile(options['audit-plan']));
    if (options.json) printJson(result);
    else {
      process.stdout.write(`${result.valid ? 'valid' : 'invalid'}: ${result.violations.length} violations\n`);
      for (const item of result.violations) process.stdout.write(`${item.code} ${item.path}: ${item.message}\n`);
    }
    if (!result.valid) process.exitCode = 1;
  } else if (options.normalize) {
    if (!options.input) throw new Error('Option --input is required when --normalize is used.');
    const records = normalizeCaptured(await readJsonFile(options.input));
    if (options.out) await fs.writeFile(options.out, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
    if (options.json) printJson(records);
    else process.stdout.write(`${records.length} evidence records\n`);
  } else {
    if (!options.channel) throw new Error('Option --channel is required.');
    if (!options.brief) throw new Error('Option --brief is required.');
    const intent = options.intent ? await readJsonFile(options.intent) : undefined;
    const plan = searchPlan({ channel: options.channel, brief: options.brief, tiers: options.tiers, intent, emotion: options.emotion });
    if (options.json) printJson(plan);
    else process.stdout.write(`${plan.status}: ${plan.queries.length} queries across ${plan.targets.length} targets\n`);
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
