import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectDesignTokens, inspectProject } from './project-inspector.mjs';

test('theme blocks yield real token values', () => {
  const tokens = collectDesignTokens([
    [
      '@layer base {',
      '  :root {',
      '    --background: oklch(1 0 0);',
      '    --primary: #111827;',
      '    --radius: 0.625rem;',
      '  }',
      '}',
      'body { font-family: Inter, system-ui, sans-serif; }',
    ].join('\n'),
  ]);

  assert.equal(tokens.variables.length, 3);
  assert.equal(tokens.truncated, false);
  assert.equal(tokens.radius.find((token) => token.name === '--radius').value, '0.625rem');
  assert.ok(tokens.colorRoles.some((token) => token.name === '--primary'));
  assert.deepEqual(tokens.fontFamilies, ['Inter, system-ui, sans-serif']);
});

test('declarations outside a theme block are ignored', () => {
  const tokens = collectDesignTokens(['.card { --not-a-token: 1px; color: red; }']);
  assert.deepEqual(tokens.variables, []);
});

test('inspectProject reports the extracted tokens', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cdf-tokens-'));
  try {
    await fs.mkdir(path.join(root, 'src', 'app'), { recursive: true });
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ dependencies: { react: '19.0.0' } }));
    await fs.writeFile(
      path.join(root, 'src', 'app', 'globals.css'),
      ':root { --color-foreground: #0a0a0a; --radius-sm: 4px; }',
    );

    const project = await inspectProject(root);
    assert.equal(project.designTokens.variables.length, 2);
    assert.equal(project.designTokens.radius[0].name, '--radius-sm');
    assert.ok(project.themeFiles.includes(path.join('src', 'app', 'globals.css')));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
