#!/usr/bin/env node
import { parseArgs, printJson } from './lib/cli.mjs';
import { inspectShell } from './lib/shell-inspector.mjs';

const help = `Usage:
  inspect-shell.mjs --root <project> [--json]

  Inventories routes, layout chains, route groups, and segment states for Next app/pages,
  Remix, and Astro, so a shell plan starts from the real route map.
`;

try {
  const options = parseArgs(process.argv.slice(2), {
    root: { type: 'string', default: '.' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  });

  if (options.help) {
    process.stdout.write(help);
  } else {
    const report = await inspectShell(options.root);

    if (options.json) {
      printJson(report);
    } else if (!report.router) {
      process.stdout.write(`${report.warnings[0]}\n`);
    } else {
      process.stdout.write(`Router: ${report.router} (${report.rootDirectory}/)\n`);
      process.stdout.write(`Pages: ${report.stats.pages} (${report.stats.dynamicPages} dynamic) · API routes: ${report.stats.apiRoutes}\n`);
      process.stdout.write(`Layouts: ${report.layouts.length ? report.layouts.join(', ') : 'none'}\n`);
      if (report.routeGroups.length) process.stdout.write(`Route groups: ${report.routeGroups.join(', ')}\n`);

      process.stdout.write('\nRoutes:\n');
      for (const route of report.routes.slice(0, 40)) {
        const states = Object.entries(route.states).filter(([, value]) => value).map(([name]) => name);
        const layout = route.layoutChain.length ? route.layoutChain[route.layoutChain.length - 1] : 'no layout';
        process.stdout.write(
          `  ${route.path.padEnd(30)} ${route.type.padEnd(6)} ${route.file.replace(`${report.rootDirectory}/`, '')}  ${layout}${states.length ? `  [${states.join(',')}]` : ''}\n`,
        );
      }

      if (report.shell.sharedDirectories.length) {
        process.stdout.write('\nShell candidates (directories with several pages):\n');
        for (const entry of report.shell.sharedDirectories) {
          process.stdout.write(`  ${entry.directory}  ${entry.pages} pages\n`);
        }
      }

      for (const warning of report.warnings) process.stdout.write(`\nwarning: ${warning}\n`);
    }
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
