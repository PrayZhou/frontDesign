#!/usr/bin/env node
import { parseArgs, printJson } from './lib/cli.mjs';
import { inspectBrandColors } from './lib/brand-colors.mjs';

const help = `Usage:
  brand-colors.mjs --root <project> [--assets assets] [--limit 5] [--max-distance 0.12] [--json]

  Reads theme tokens (with contrast against the background token) and extracts the dominant
  colors from PNG files under the assets directory, flagging brand colors with no token match.
`;

try {
  const options = parseArgs(process.argv.slice(2), {
    root: { type: 'string', default: '.' },
    assets: { type: 'string', default: 'assets' },
    limit: { type: 'string', default: '5' },
    'max-distance': { type: 'string', default: '0.12' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  });

  if (options.help) {
    process.stdout.write(help);
  } else {
    const limit = Number(options.limit);
    const maxDistance = Number(options['max-distance']);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      throw new Error('Option --limit must be an integer between 1 and 20.');
    }
    if (!Number.isFinite(maxDistance) || maxDistance <= 0 || maxDistance > 1) {
      throw new Error('Option --max-distance must be between 0 and 1.');
    }

    const result = await inspectBrandColors({
      root: options.root,
      assets: options.assets,
      limit,
      maxDistance,
    });

    if (options.json) {
      printJson(result);
    } else {
      if (result.theme.background) {
        process.stdout.write(`Theme colors (contrast on ${result.theme.background.hex}):\n`);
      } else {
        process.stdout.write('Theme colors (no background token found):\n');
      }
      for (const color of result.theme.colors.slice(0, 24)) {
        const ratio = color.contrastWithBackground === null ? '   n/a' : `${color.contrastWithBackground.toFixed(2)}:1`.padStart(8);
        process.stdout.write(`  ${color.name.padEnd(24)} ${color.hex}  ${ratio}\n`);
      }

      if (result.assets.length) {
        process.stdout.write('\nBrand palette:\n');
        for (const asset of result.assets) {
          process.stdout.write(`  ${asset.file}  (${asset.samples} samples)\n`);
          for (const entry of asset.palette) {
            const nearest = entry.nearestToken
              ? `nearest ${entry.nearestToken} (Δ${entry.distance.toFixed(3)})`
              : 'no theme token';
            process.stdout.write(`    ${entry.hex}  ${(entry.share * 100).toFixed(1).padStart(5)}%  ${nearest}${entry.matched ? '' : '  UNMATCHED'}\n`);
          }
        }
      }

      if (result.warnings.length) {
        process.stdout.write('\nWarnings:\n');
        for (const warning of result.warnings) process.stdout.write(`  ${warning}\n`);
      }
    }
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
