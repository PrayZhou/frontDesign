import path from 'node:path';
import { listFiles } from './files.mjs';

const EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js', '.astro'];
const COMPONENT_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js'];

function toPattern(segment) {
  if (/^\[\[\.\.\..+\]\]$/.test(segment)) return `*${segment.slice(5, -2)}?`;
  if (/^\[\.\.\..+\]$/.test(segment)) return `*${segment.slice(4, -1)}`;
  if (/^\[.+\]$/.test(segment)) return `:${segment.slice(1, -1)}`;
  return segment;
}

function routeFromSegments(segments) {
  const visible = segments
    .filter((segment) => segment && !/^\(.+\)$/.test(segment))
    .map(toPattern);
  const route = `/${visible.join('/')}`.replace(/\/{2,}/g, '/');
  return route === '' ? '/' : route.replace(/\/$/, '') || '/';
}

function findComponent(files, directory, name) {
  const base = directory ? `${directory}/` : '';
  for (const extension of COMPONENT_EXTENSIONS) {
    const candidate = `${base}${name}.${extension}`;
    if (files.includes(candidate)) return candidate;
  }
  return null;
}

function layoutChain(files, rootDirectory, segments) {
  const chain = [];
  const ancestors = [''];
  for (let index = 0; index < segments.length; index += 1) {
    ancestors.push(segments.slice(0, index + 1).join('/'));
  }
  for (const ancestor of ancestors) {
    const directory = ancestor ? `${rootDirectory}/${ancestor}` : rootDirectory;
    const layout = findComponent(files, directory, 'layout');
    if (layout) chain.push(layout);
  }
  return chain;
}

function segmentStates(files, directory) {
  return {
    loading: Boolean(findComponent(files, directory, 'loading')),
    error: Boolean(findComponent(files, directory, 'error')),
    notFound: Boolean(findComponent(files, directory, 'not-found')),
    template: Boolean(findComponent(files, directory, 'template')),
  };
}

function appRouterRoutes(files, rootDirectory) {
  const prefix = `${rootDirectory}/`;
  return files
    .filter((file) => file.startsWith(prefix))
    .map((file) => ({ file, relative: file.slice(prefix.length) }))
    .map(({ file, relative }) => {
      const match = relative.match(/^(.*?)(page|route)\.(tsx|ts|jsx|js)$/);
      if (!match) return null;
      const directoryPart = match[1].replace(/\/$/, '');
      const segments = directoryPart ? directoryPart.split('/') : [];
      const directory = directoryPart ? `${rootDirectory}/${directoryPart}` : rootDirectory;
      const isRouteHandler = match[2] === 'route';
      return {
        path: routeFromSegments(segments),
        pattern: routeFromSegments(segments),
        file,
        type: isRouteHandler ? 'route' : 'page',
        dynamic: segments.some((segment) => segment.startsWith('[')),
        routeGroups: segments.filter((segment) => /^\(.+\)$/.test(segment)).map((segment) => segment.slice(1, -1)),
        // Route handlers do not render through layouts.
        layoutChain: isRouteHandler ? [] : layoutChain(files, rootDirectory, segments),
        states: isRouteHandler
          ? { loading: false, error: false, notFound: false, template: false }
          : segmentStates(files, directory),
      };
    })
    .filter(Boolean);
}

function pagesRouterRoutes(files, rootDirectory) {
  const prefix = `${rootDirectory}/`;
  const hasApp = files.includes(`${rootDirectory}/_app.tsx`) || files.includes(`${rootDirectory}/_app.jsx`)
    || files.includes(`${rootDirectory}/_app.ts`) || files.includes(`${rootDirectory}/_app.js`);

  return files
    .filter((file) => file.startsWith(prefix) && /\.(tsx|ts|jsx|js)$/.test(file))
    .map((file) => ({ file, relative: file.slice(prefix.length) }))
    .filter(({ relative }) => !relative.startsWith('_'))
    .map(({ file, relative }) => {
      const withoutExtension = relative.replace(/\.[^.]+$/, '');
      const segments = withoutExtension.split('/');
      const isApi = segments[0] === 'api';
      if (segments[segments.length - 1] === 'index') segments.pop();
      return {
        path: routeFromSegments(segments),
        pattern: routeFromSegments(segments),
        file,
        type: isApi ? 'api' : 'page',
        dynamic: segments.some((segment) => segment.startsWith('[')),
        routeGroups: [],
        layoutChain: hasApp && !isApi ? [`${rootDirectory}/_app`] : [],
        states: { loading: false, error: false, notFound: false, template: false },
      };
    });
}

function remixRoutes(files, rootDirectory) {
  const prefix = `${rootDirectory}/`;
  return files
    .filter((file) => file.startsWith(prefix) && /\.(tsx|ts|jsx|js)$/.test(file))
    .map((file) => ({ file, name: path.posix.basename(file).replace(/\.[^.]+$/, '') }))
    .filter(({ name }) => name !== 'root')
    .map(({ file, name }) => {
      const rawParts = name.split('.').filter((part) => !part.startsWith('_'));
      const segments = [];
      for (const part of rawParts) {
        if (part === '$') segments.push('*');
        else if (part.startsWith('$')) segments.push(`:${part.slice(1)}`);
        else segments.push(part);
      }
      const route = routeFromSegments(segments);
      return {
        path: route,
        pattern: route,
        file,
        type: 'page',
        dynamic: rawParts.some((part) => part.startsWith('$')),
        routeGroups: [],
        layoutChain: (() => {
          const rootLayout = path.posix.normalize(`${rootDirectory}/../root.tsx`);
          return files.includes(rootLayout) ? [rootLayout] : [];
        })(),
        states: { loading: false, error: false, notFound: false, template: false },
      };
    });
}

function astroRoutes(files, rootDirectory) {
  const prefix = `${rootDirectory}/`;
  return files
    .filter((file) => file.startsWith(prefix) && file.endsWith('.astro'))
    .map((file) => {
      const relative = file.slice(prefix.length).replace(/\.astro$/, '');
      const segments = relative.split('/');
      if (segments[segments.length - 1] === 'index') segments.pop();
      const route = routeFromSegments(segments);
      return {
        path: route,
        pattern: route,
        file,
        type: 'page',
        dynamic: segments.some((segment) => segment.startsWith('[')),
        routeGroups: [],
        layoutChain: files.filter((candidate) => candidate.startsWith('src/layouts/')).slice(0, 3),
        states: { loading: false, error: false, notFound: false, template: false },
      };
    });
}

async function detectRouter(files) {
  const hasAppPages = files.some((file) => /^(src\/)?app\/.*(page|route)\.(tsx|ts|jsx|js)$/.test(file));
  if (hasAppPages) {
    const rootDirectory = files.some((file) => file.startsWith('src/app/')) ? 'src/app' : 'app';
    return { router: 'app', rootDirectory };
  }

  const pagesPrefix = files.some((file) => file.startsWith('src/pages/')) ? 'src/pages' : 'pages';
  if (files.some((file) => file.startsWith(`${pagesPrefix}/`) && /\.(tsx|ts|jsx|js)$/.test(file))) {
    return { router: 'pages', rootDirectory: pagesPrefix };
  }

  if (files.some((file) => file.startsWith('app/routes/'))) {
    return { router: 'remix', rootDirectory: 'app/routes' };
  }

  if (files.some((file) => file.startsWith('src/pages/') && file.endsWith('.astro'))) {
    return { router: 'astro', rootDirectory: 'src/pages' };
  }

  return null;
}

export async function inspectShell(root) {
  const resolvedRoot = path.resolve(root);
  const files = await listFiles(resolvedRoot, { extensions: EXTENSIONS });
  const detected = await detectRouter(files);

  if (!detected) {
    return {
      root: resolvedRoot,
      router: null,
      rootDirectory: null,
      routes: [],
      layouts: [],
      routeGroups: [],
      stats: { pages: 0, apiRoutes: 0, dynamicPages: 0, routesWithLoading: 0, routesWithoutError: 0 },
      shell: { hasRootLayout: false, sharedDirectories: [] },
      warnings: ['No supported router (Next app/pages, Remix, Astro) was found.'],
    };
  }

  const warnings = [];
  let routes;
  if (detected.router === 'app') routes = appRouterRoutes(files, detected.rootDirectory);
  else if (detected.router === 'pages') routes = pagesRouterRoutes(files, detected.rootDirectory);
  else if (detected.router === 'remix') routes = remixRoutes(files, detected.rootDirectory);
  else routes = astroRoutes(files, detected.rootDirectory);

  routes.sort((left, right) => left.path.localeCompare(right.path));

  const pages = routes.filter((route) => route.type === 'page');
  const layouts = [...new Set(routes.flatMap((route) => route.layoutChain))].sort();
  const routeGroups = [...new Set(routes.flatMap((route) => route.routeGroups))].sort();
  const dynamicPages = pages.filter((route) => route.dynamic);
  const routesWithLoading = pages.filter((route) => route.states.loading);
  const routesWithoutError = pages.filter((route) => !route.states.error);

  // A top-level section with more than one page needs a shared shell (nav, breadcrumb, header),
  // which is what the plan should describe.
  const sectionCounts = new Map();
  for (const route of pages) {
    const relative = route.file.startsWith(`${detected.rootDirectory}/`)
      ? route.file.slice(detected.rootDirectory.length + 1)
      : route.file;
    const segments = relative.split('/');
    if (segments.length < 2 || segments[0].startsWith('[') || segments[0].startsWith('(')) continue;
    sectionCounts.set(segments[0], (sectionCounts.get(segments[0]) ?? 0) + 1);
  }
  const sharedDirectories = [...sectionCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([section, count]) => ({ directory: `${detected.rootDirectory}/${section}`, pages: count }))
    .sort((left, right) => right.pages - left.pages);

  if (detected.router === 'app') {
    const hasPagesRouter = files.some((file) => /^(src\/)?pages\/.+\.(tsx|jsx)$/.test(file));
    if (hasPagesRouter) warnings.push('Both app/ and pages/ contain routes; confirm which router serves the page under review.');
    if (pages.length > 0 && routesWithoutError.length === pages.length) {
      warnings.push('No segment declares an error boundary; a failed route falls back to the framework default.');
    }
  }

  return {
    root: resolvedRoot,
    router: detected.router,
    rootDirectory: detected.rootDirectory,
    routes,
    layouts,
    routeGroups,
    stats: {
      pages: pages.length,
      apiRoutes: routes.filter((route) => route.type === 'route' || route.type === 'api').length,
      dynamicPages: dynamicPages.length,
      routesWithLoading: routesWithLoading.length,
      routesWithoutError: routesWithoutError.length,
    },
    shell: {
      hasRootLayout: layouts.length > 0,
      sharedDirectories,
    },
    warnings,
  };
}
