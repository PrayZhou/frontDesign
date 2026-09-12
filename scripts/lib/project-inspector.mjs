import { promises as fs } from 'node:fs';
import path from 'node:path';

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.cache',
  '.parcel-cache',
  '.turbo',
  '.vite',
  '.agents',
  '.superpowers',
  '__tests__',
  'coverage',
  'fixtures',
  'test',
  'tests',
]);
const COMPONENT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte']);
const NON_PRODUCTION_COMPONENT_PATTERN = /(?:^|[./\\])(?:__snapshots__|fixtures?|mocks?|stories?)(?:[./\\]|$)|(?:\.(?:test|spec|stories))\.[^.]+$/i;

const packageNames = (packageJson = {}) => new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
  ...Object.keys(packageJson.peerDependencies ?? {}),
]);

const hasPackage = (names, ...candidates) => candidates.some((candidate) => names.has(candidate));

export async function readJsonFile(filePath, { optional = false } = {}) {
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    try {
      return JSON.parse(contents);
    } catch (error) {
      const parseError = new SyntaxError(`Could not parse JSON file: ${filePath}: ${error.message}`);
      parseError.code = 'INVALID_JSON';
      throw parseError;
    }
  } catch (error) {
    if (optional && error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function detectPackageManager(root, packageJson = {}) {
  if (typeof packageJson.packageManager === 'string') {
    return packageJson.packageManager.split('@')[0];
  }

  for (const [fileName, manager] of [
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
    ['bun.lock', 'bun'],
    ['package-lock.json', 'npm'],
  ]) {
    try {
      await fs.access(path.join(root, fileName));
      return manager;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return null;
}

export function detectFramework(packageJson = {}) {
  const names = packageNames(packageJson);
  const detected = [];
  for (const [name, dependencies] of [
    ['next', ['next']],
    ['remix', ['@remix-run/react', '@remix-run/dev']],
    ['astro', ['astro']],
    ['vite', ['vite']],
    ['react', ['react']],
  ]) {
    if (hasPackage(names, ...dependencies)) detected.push(name);
  }
  return { primary: detected[0] ?? null, detected };
}

export function detectStyling(packageJson = {}, fileNames = [], stylesheetContents = []) {
  const names = packageNames(packageJson);
  const files = fileNames.map((fileName) => fileName.toLowerCase());
  const contents = Array.isArray(stylesheetContents)
    ? stylesheetContents
    : stylesheetContents && typeof stylesheetContents === 'object'
      ? Object.values(stylesheetContents)
      : [];
  const styling = [];
  const hasTailwindDependency = hasPackage(
    names,
    'tailwindcss',
    '@tailwindcss/cli',
    '@tailwindcss/postcss',
    '@tailwindcss/vite',
  );
  const hasTailwindConfig = files.some((fileName) => (
    /(^|[\\/])tailwind\.config\.(?:js|cjs|mjs|ts|cts|mts)$/.test(fileName)
  ));
  const hasTailwindCssMarker = contents.some((content) => (
    typeof content === 'string'
    && (/@tailwind\s+(?:base|components|utilities)\s*;/i.test(content)
      || /@import\s+["']tailwindcss(?:\/[^"']*)?["']/i.test(content))
  ));
  if (hasTailwindDependency || hasTailwindConfig || hasTailwindCssMarker) styling.push('tailwind');
  if (files.some((fileName) => /\.module\.(css|scss|sass|less)$/.test(fileName))) styling.push('css-modules');
  if (hasPackage(names, 'styled-components')) styling.push('styled-components');
  if (hasPackage(names, '@emotion/react', '@emotion/styled')) styling.push('emotion');
  return styling;
}

export function detectDesignSystems(packageJson = {}, componentsJson = null) {
  const names = packageNames(packageJson);
  const systems = [];
  if (componentsJson) systems.push('shadcn');
  if (hasPackage(names, '@heroui/react', '@nextui-org/react')) systems.push('heroui');
  if (hasPackage(names, '@mantine/core')) systems.push('mantine');
  if (hasPackage(names, '@mui/material')) systems.push('mui');
  if (hasPackage(names, 'antd')) systems.push('ant-design');
  if (hasPackage(names, '@chakra-ui/react')) systems.push('chakra-ui');
  return systems;
}

async function walkFiles(root, relative = '') {
  const directory = path.join(root, relative);
  let entries;
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const entryRelative = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name) || (entry.name.startsWith('.') && entry.name.includes('cache'))) continue;
      files.push(...await walkFiles(root, entryRelative));
    } else if (entry.isFile()) {
      files.push(entryRelative);
    }
  }
  return files;
}

export async function discoverComponents(root, candidateDirectories) {
  const components = [];
  for (const directory of candidateDirectories) {
    const absoluteDirectory = path.join(root, directory);
    let files;
    try {
      files = await walkFiles(absoluteDirectory);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    for (const file of files) {
      const extension = path.extname(file);
      if (!COMPONENT_EXTENSIONS.has(extension)
        || /(^|[\\/])index\./i.test(file)
        || NON_PRODUCTION_COMPONENT_PATTERN.test(file)) continue;
      components.push({
        name: path.basename(file, extension).replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
        path: path.join(directory, file),
      });
    }
  }
  return components;
}

function librariesFrom(packageJson = {}) {
  const names = packageNames(packageJson);
  const libraries = [];
  if (hasPackage(names, 'lucide-react', 'lucide-vue-next')) libraries.push('lucide');
  if (hasPackage(names, 'recharts')) libraries.push('recharts');
  if (hasPackage(names, '@tanstack/react-table', '@tanstack/table-core')) libraries.push('tanstack-table');
  if (hasPackage(names, 'framer-motion', 'motion')) libraries.push('motion');
  if (hasPackage(names, 'sonner')) libraries.push('sonner');
  return libraries;
}

export async function inspectProject(root) {
  const resolvedRoot = path.resolve(root);
  const warnings = [];
  let packageJson = {};
  let componentsJson = null;

  try {
    packageJson = await readJsonFile(path.join(resolvedRoot, 'package.json'), { optional: true }) ?? {};
  } catch (error) {
    warnings.push(`Could not parse package.json: ${error.message}`);
  }
  try {
    componentsJson = await readJsonFile(path.join(resolvedRoot, 'components.json'), { optional: true });
  } catch (error) {
    warnings.push(`Could not parse components.json: ${error.message}`);
  }

  let fileNames = [];
  try {
    fileNames = await walkFiles(resolvedRoot);
  } catch (error) {
    warnings.push(`Could not read project directory: ${error.message}`);
  }

  const stylesheetContents = [];
  for (const fileName of fileNames.filter((name) => /\.(?:css|scss|sass|less)$/i.test(name))) {
    try {
      stylesheetContents.push(await fs.readFile(path.join(resolvedRoot, fileName), 'utf8'));
    } catch (error) {
      warnings.push(`Could not inspect stylesheet ${fileName}: ${error.message}`);
    }
  }

  const candidateDirectories = ['components', 'src/components', 'app/components', 'src/app/components'];
  const componentDirectories = [];
  for (const directory of candidateDirectories) {
    try {
      if ((await fs.stat(path.join(resolvedRoot, directory))).isDirectory()) componentDirectories.push(directory);
    } catch (error) {
      if (error.code !== 'ENOENT') warnings.push(`Could not inspect ${directory}: ${error.message}`);
    }
  }

  let components = [];
  try {
    components = await discoverComponents(resolvedRoot, componentDirectories);
  } catch (error) {
    warnings.push(`Could not discover components: ${error.message}`);
  }

  const framework = detectFramework(packageJson);
  const styling = detectStyling(packageJson, fileNames, stylesheetContents);
  const designSystems = detectDesignSystems(packageJson, componentsJson);
  const activeFoundation = designSystems.length === 1 ? designSystems[0] : null;
  const themeFiles = fileNames.filter((fileName) => (
    /(^|[\\/])(globals|theme|tailwind)\.(css|scss|sass|less|js|ts|mjs|cjs)$/i.test(fileName)
    || /(^|[\\/])tailwind\.config\.(js|cjs|mjs|ts|cts|mts)$/i.test(fileName)
  ));
  if (!Object.keys(packageJson).length) warnings.push('No readable package.json found.');
  if (!framework.primary) warnings.push('Could not identify a supported framework.');
  if (designSystems.length > 1) {
    warnings.push(`Multiple foundation systems detected: ${designSystems.join(', ')}. Active foundation is unknown until page/import evidence resolves the conflict.`);
  }

  const registries = componentsJson && typeof componentsJson.registries === 'object' && componentsJson.registries
    ? Object.keys(componentsJson.registries).sort()
    : [];
  const confidence = framework.primary && (styling.length || designSystems.length || components.length) ? 'high'
    : framework.primary || Object.keys(packageJson).length ? 'medium'
      : 'low';

  return {
    root: resolvedRoot,
    framework,
    packageManager: await detectPackageManager(resolvedRoot, packageJson),
    styling,
    designSystems,
    activeFoundation,
    libraries: librariesFrom(packageJson),
    shadcn: { configPath: componentsJson ? 'components.json' : null, registries },
    componentDirectories,
    components,
    themeFiles,
    warnings,
    confidence,
  };
}
