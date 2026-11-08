#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { parseArgs, printJson } from './lib/cli.mjs';
import { inspectProject, readJsonFile } from './lib/project-inspector.mjs';
import { buildQaPlan, renderPlaywrightSpec, renderQaMarkdown } from './lib/qa-plan.mjs';

const help = `Usage:
  visual-qa-plan.mjs --file <plan-or-brief.json> [--root <project>] [--route /path] [--out <qa.md>] [--json]
  visual-qa-plan.mjs --file <plan-or-brief.json> --root <project> --emit playwright --out <qa.spec.ts> [--route /path]

  --file <path>       component plan or a framework-independent design brief with designIntent
  --root <project>    add contrast pairs derived from the project's theme tokens
  --route <path>      route to review; repeat for every page in the shell (default: /)
  --emit playwright   emit a Playwright spec skeleton instead of the markdown checklist
`;

const EMITTERS = new Set(['markdown', 'playwright']);

try {
  const options = parseArgs(process.argv.slice(2), {
    file: { type: 'string' },
    root: { type: 'string' },
    route: { type: 'string', repeatable: true },
    out: { type: 'string' },
    emit: { type: 'string', default: 'markdown' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  });

  if (options.help) {
    process.stdout.write(help);
  } else if (!options.file) {
    throw new Error('Option --file is required');
  } else if (!EMITTERS.has(options.emit)) {
    throw new Error(`Option --emit must be markdown or playwright, received ${options.emit}`);
  } else {
    const plan = await readJsonFile(options.file);
    const project = options.root ? await inspectProject(options.root) : undefined;
    const qa = buildQaPlan(plan, { designTokens: project?.designTokens, routes: options.route });
    const output = options.emit === 'playwright' ? renderPlaywrightSpec(qa) : renderQaMarkdown(qa);

    if (options.out) await fs.writeFile(options.out, output, 'utf8');
    if (options.json) printJson(qa);
    else process.stdout.write(output);
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
