import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { extractDependencies, normalizeRegistry, queryProject } from './component-query.mjs';

test('capability inference matches whole words only', () => {
  const [candidate] = normalizeRegistry({
    items: [{ name: 'discard-dialog', description: 'metadata cleanup', type: 'registry:ui' }],
  }, 'registry-file');
  assert.deepEqual(candidate.capabilities, ['overlay']);
});

test('capability inference emits canonical plan tokens', () => {
  const [candidate] = normalizeRegistry({
    items: [{ name: 'animated-hero', description: 'marquee motion hero', type: 'registry:ui' }],
  }, 'registry-file');
  assert.ok(candidate.capabilities.includes('interactive'));
  assert.ok(candidate.capabilities.includes('marketing'));
  assert.ok(!candidate.capabilities.includes('animation'), 'discovery must not emit a non-canonical token');
});

test('dependency extraction keeps package names only', () => {
  const source = [
    "import { Line } from 'recharts';",
    "import y from '@scope/pkg/sub';",
    "import fs from 'node:fs';",
    "import './local';",
    "const z = require('sonner');",
    "import 'side-effect-pkg';",
  ].join('\n');
  assert.deepEqual(extractDependencies(source), ['@scope/pkg', 'recharts', 'side-effect-pkg', 'sonner']);
});

test('project queries follow components.json aliases and hydrate dependencies', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cdf-query-'));
  try {
    await fs.mkdir(path.join(root, 'app', 'ui'), { recursive: true });
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({
      dependencies: { react: '19.0.0', recharts: '2.0.0' },
    }));
    await fs.writeFile(path.join(root, 'components.json'), JSON.stringify({ aliases: { components: '@/app/ui' } }));
    await fs.writeFile(
      path.join(root, 'app', 'ui', 'revenue-chart.tsx'),
      "import { Line } from 'recharts';\nimport { Card } from '@acme/ui';\n",
    );

    const result = await queryProject(root, 'chart');
    const [candidate] = result.candidates;
    assert.equal(candidate.name, 'revenue-chart');
    assert.deepEqual(candidate.dependencies, ['@acme/ui', 'recharts']);
    assert.ok(candidate.capabilities.includes('chart'));
    // +15 name token, +12 capability, +4 description, +30 project bonus, -2 for the one
    // dependency that is not installed. Installed packages must not be penalized.
    assert.equal(candidate.relevanceScore, 59);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('a query with no matching token returns no candidates', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cdf-query-empty-'));
  try {
    await fs.mkdir(path.join(root, 'src', 'components'), { recursive: true });
    await fs.writeFile(path.join(root, 'src', 'components', 'badge.tsx'), 'export const Badge = () => null;\n');
    const result = await queryProject(root, 'zzz');
    assert.deepEqual(result.candidates, []);
    assert.equal(result.status, 'ok');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
