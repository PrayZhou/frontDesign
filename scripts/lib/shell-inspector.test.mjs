import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectShell } from './shell-inspector.mjs';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'inspect-shell.mjs');

async function fixture(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cdf-shell-'));
  for (const [file, contents] of Object.entries(files)) {
    const target = path.join(root, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, contents);
  }
  return root;
}

test('app router routes carry layouts, groups, and segment states', async () => {
  const root = await fixture({
    'app/layout.tsx': 'export default function Layout() {}',
    'app/page.tsx': 'export default function Page() {}',
    'app/(marketing)/pricing/page.tsx': 'export default function Page() {}',
    'app/dashboard/layout.tsx': 'export default function Layout() {}',
    'app/dashboard/page.tsx': 'export default function Page() {}',
    'app/dashboard/settings/page.tsx': 'export default function Page() {}',
    'app/dashboard/loading.tsx': 'export default function Loading() {}',
    'app/dashboard/error.tsx': 'export default function Error() {}',
    'app/blog/[slug]/page.tsx': 'export default function Page() {}',
    'app/api/health/route.ts': 'export function GET() {}',
  });

  try {
    const report = await inspectShell(root);
    assert.equal(report.router, 'app');
    assert.equal(report.rootDirectory, 'app');

    const paths = report.routes.filter((route) => route.type === 'page').map((route) => route.path).sort();
    assert.deepEqual(paths, ['/', '/blog/:slug', '/dashboard', '/dashboard/settings', '/pricing']);
    assert.equal(report.stats.apiRoutes, 1);
    assert.equal(report.stats.pages, 5);

    const dashboard = report.routes.find((route) => route.path === '/dashboard');
    assert.deepEqual(dashboard.layoutChain, ['app/layout.tsx', 'app/dashboard/layout.tsx']);
    assert.equal(dashboard.states.loading, true);
    assert.equal(dashboard.states.error, true);

    const blog = report.routes.find((route) => route.path === '/blog/:slug');
    assert.equal(blog.dynamic, true);
    assert.deepEqual(blog.layoutChain, ['app/layout.tsx']);

    assert.deepEqual(report.routeGroups, ['marketing']);
    assert.ok(report.shell.sharedDirectories.some((entry) => entry.directory === 'app/dashboard'));
    assert.equal(report.shell.hasRootLayout, true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('pages router routes exclude app files and api directories', async () => {
  const root = await fixture({
    'pages/_app.tsx': 'export default function App() {}',
    'pages/_document.tsx': 'export default function Document() {}',
    'pages/index.tsx': 'export default function Home() {}',
    'pages/settings/index.tsx': 'export default function Settings() {}',
    'pages/api/users.ts': 'export default function handler() {}',
  });

  try {
    const report = await inspectShell(root);
    assert.equal(report.router, 'pages');
    assert.deepEqual(
      report.routes.filter((route) => route.type === 'page').map((route) => route.path).sort(),
      ['/', '/settings'],
    );
    assert.equal(report.stats.apiRoutes, 1);
    assert.deepEqual(report.routes.find((route) => route.type === 'page').layoutChain, ['pages/_app']);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('remix flat routes map to url patterns', async () => {
  const root = await fixture({
    'app/routes/_index.tsx': 'export default function Index() {}',
    'app/routes/_auth.login.tsx': 'export default function Login() {}',
    'app/routes/concerts.$city.tsx': 'export default function City() {}',
    'app/root.tsx': 'export default function Root() {}',
  });

  try {
    const report = await inspectShell(root);
    assert.equal(report.router, 'remix');
    assert.deepEqual(report.routes.map((route) => route.path).sort(), ['/', '/concerts/:city', '/login']);
    assert.equal(report.routes.find((route) => route.path === '/concerts/:city').dynamic, true);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('astro pages and dynamic segments are detected', async () => {
  const root = await fixture({
    'src/pages/index.astro': '<h1>Home</h1>',
    'src/pages/about.astro': '<h1>About</h1>',
    'src/pages/blog/[slug].astro': '<h1>Post</h1>',
    'src/layouts/Base.astro': '<slot />',
  });

  try {
    const report = await inspectShell(root);
    assert.equal(report.router, 'astro');
    assert.deepEqual(report.routes.map((route) => route.path).sort(), ['/', '/about', '/blog/:slug']);
    assert.equal(report.stats.dynamicPages, 1);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('an unknown project reports that no router was found', async () => {
  const root = await fixture({ 'README.md': '# nothing' });
  try {
    const report = await inspectShell(root);
    assert.equal(report.router, null);
    assert.deepEqual(report.routes, []);
    assert.match(report.warnings[0], /No supported router/);

    const cliRun = await run(process.execPath, [cli, '--root', root]);
    assert.match(cliRun.stdout, /No supported router/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('the CLI prints a route inventory as JSON', async () => {
  const root = await fixture({
    'app/layout.tsx': 'export default function Layout() {}',
    'app/page.tsx': 'export default function Page() {}',
  });
  try {
    const { stdout } = await run(process.execPath, [cli, '--root', root, '--json']);
    const report = JSON.parse(stdout);
    assert.equal(report.router, 'app');
    assert.equal(report.routes[0].path, '/');
    assert.equal(report.routes[0].layoutChain[0], 'app/layout.tsx');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
