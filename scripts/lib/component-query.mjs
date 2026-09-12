import path from 'node:path';
import { inspectProject, readJsonFile } from './project-inspector.mjs';

// These keywords deliberately describe user-facing capabilities rather than a registry's vendor-specific types.
const CAPABILITY_KEYWORDS = {
  navigation: ['navigation', 'nav', 'menu', 'breadcrumb', 'sidebar', 'tabs', 'pagination'],
  forms: ['form', 'input', 'select', 'checkbox', 'radio', 'switch', 'combobox', 'datepicker'],
  data: ['data', 'list', 'card', 'avatar', 'badge', 'stat', 'timeline', 'gallery'],
  overlay: ['dialog', 'modal', 'popover', 'drawer', 'sheet', 'tooltip', 'overlay'],
  feedback: ['toast', 'alert', 'notification', 'feedback', 'progress', 'skeleton', 'spinner', 'empty'],
  layout: ['layout', 'container', 'grid', 'separator', 'resizable', 'scroll', 'accordion'],
  animation: ['animation', 'animated', 'motion', 'transition', 'marquee', 'beam', 'sparkle'],
  marketing: ['hero', 'landing', 'pricing', 'testimonial', 'feature', 'cta', 'logo'],
  chart: ['chart', 'graph', 'rechart', 'plot', 'analytics'],
  table: ['table', 'datatable', 'data-table', 'tabular'],
};

const ONLINE_COMMANDS = {
  shadcn: (query) => `npx shadcn@latest search ${shellQuote(query)}`,
  magicui: (query) => `npx shadcn@latest search @magicui -q ${shellQuote(query)}`,
  aceternity: (query) => `npx shadcn@latest search @aceternity -q ${shellQuote(query)}`,
};

const REGISTRY_DOCS_URL = 'https://ui.shadcn.com/docs/registry/registry-home';
const TRUSTED_REGISTRY_NAMESPACES = new Map([
  ['shadcn', ''],
  ['magicui', '@magicui/'],
  ['aceternity', '@aceternity/'],
]);
const UNTRUSTED_REGISTRY_WARNING = 'Install command unavailable because this Registry file has no trusted namespace.';

export function tokenize(text = '') {
  return String(text)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function normalizedName(value = '') {
  return tokenize(value).join('-');
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\"'\"'")}'`;
}

function normalizedCapabilityToken(token) {
  return token.endsWith('s') && !token.endsWith('ss') ? token.slice(0, -1) : token;
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function asArray(registry) {
  if (Array.isArray(registry)) return registry;
  if (Array.isArray(registry?.items)) return registry.items;
  return registry && typeof registry === 'object' ? [registry] : [];
}

function inferCapabilities(item) {
  const searchableText = [
    item.name,
    item.description,
    item.type,
    ...stringArray(item.dependencies),
    ...stringArray(item.registryDependencies),
  ].join(' ').toLowerCase();
  return Object.entries(CAPABILITY_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => searchableText.includes(keyword)))
    .map(([capability]) => capability);
}

function candidateWarnings(item) {
  const warnings = [];
  const text = [item.name, item.description, item.type, ...stringArray(item.dependencies)].join(' ').toLowerCase();
  if (text.includes('client') || text.includes('use client')) warnings.push('client-only');
  if (text.includes('unknown')) warnings.push('unknown');
  return warnings;
}

function installCommand(source, name) {
  if (!TRUSTED_REGISTRY_NAMESPACES.has(source)) return null;
  return `npx shadcn@latest add ${TRUSTED_REGISTRY_NAMESPACES.get(source)}${name}`;
}

export function normalizeRegistry(registry, source = 'shadcn') {
  return asArray(registry)
    .filter((item) => item && typeof item === 'object' && item.name)
    .map((item) => {
      const name = normalizedName(item.name);
      const dependencies = [...new Set(stringArray(item.dependencies))];
      const registryDependencies = [...new Set(stringArray(item.registryDependencies))];
      const warnings = candidateWarnings(item);
      if (!TRUSTED_REGISTRY_NAMESPACES.has(source)) warnings.push(UNTRUSTED_REGISTRY_WARNING);
      return {
        id: `${source}/${name}`,
        name,
        source,
        description: typeof item.description === 'string' ? item.description : '',
        capabilities: inferCapabilities(item),
        dependencies,
        registryDependencies,
        installCommand: installCommand(source, name),
        docsUrl: typeof item.docsUrl === 'string' && item.docsUrl.trim() ? item.docsUrl : null,
        relevanceScore: 0,
        warnings,
      };
    });
}

export function candidateMatchesQuery(candidate, query) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return false;

  if (normalizedName(query) === normalizedName(candidate.name)) return true;

  const nameTokens = new Set(tokenize(candidate.name));
  const capabilityTokens = new Set(
    stringArray(candidate.capabilities).flatMap(tokenize).map(normalizedCapabilityToken),
  );
  const descriptionTokens = new Set(tokenize(candidate.description));
  return queryTokens.some((token) => (
    nameTokens.has(token)
    || capabilityTokens.has(normalizedCapabilityToken(token))
    || descriptionTokens.has(token)
  ));
}

export function scoreCandidate(candidate, query, context = {}) {
  const queryTokens = tokenize(query);
  const name = normalizedName(candidate.name);
  const nameTokens = new Set(tokenize(candidate.name));
  const capabilities = new Set(stringArray(candidate.capabilities).flatMap(tokenize).map(normalizedCapabilityToken));
  const descriptionTokens = new Set(tokenize(candidate.description));
  let score = normalizedName(query) === name ? 50 : 0;

  for (const token of queryTokens) {
    if (nameTokens.has(token)) score += 15;
    if (capabilities.has(normalizedCapabilityToken(token))) score += 12;
    if (descriptionTokens.has(token)) score += 4;
  }

  const contextualComponents = Array.isArray(context.components)
    ? context.components
    : Array.isArray(context.existingComponents) ? context.existingComponents : [];
  const existingNames = new Set(contextualComponents.map((item) => normalizedName(item.name ?? item)));
  if (candidate.inProject || existingNames.has(name)) score += 30;

  const detectedFoundation = context.activeFoundation
    ?? (Array.isArray(context.designSystems) && context.designSystems.length === 1 ? context.designSystems[0] : null);
  const foundation = candidate.foundation ?? (['shadcn', 'magicui', 'aceternity'].includes(candidate.source) ? 'shadcn' : candidate.source);
  if (detectedFoundation === foundation) score += 20;

  const existingDependencies = new Set(Array.isArray(context.dependencies) ? context.dependencies : []);
  score -= stringArray(candidate.dependencies).filter((dependency) => !existingDependencies.has(dependency)).length * 2;
  score -= stringArray(candidate.warnings).filter((warning) => warning === 'client-only' || warning === 'unknown').length * 5;
  return score;
}

function sortCandidates(candidates, query, context) {
  return candidates
    .filter((candidate) => candidateMatchesQuery(candidate, query))
    .map((candidate) => ({ ...candidate, relevanceScore: scoreCandidate(candidate, query, context) }))
    .sort((left, right) => right.relevanceScore - left.relevanceScore || left.name.localeCompare(right.name));
}

function result({ source, query, status, candidates = [], nextActions = [], warnings = [] }) {
  return { source, query, status, candidates, nextActions, warnings };
}

export async function queryRegistryFile(filePath, query, source = 'shadcn') {
  const registry = await readJsonFile(path.resolve(filePath));
  const candidates = sortCandidates(normalizeRegistry(registry, source), query, {});
  const warnings = TRUSTED_REGISTRY_NAMESPACES.has(source) ? [] : [UNTRUSTED_REGISTRY_WARNING];
  return result({ source, query, status: 'ok', candidates, warnings });
}

export async function queryProject(root, query) {
  const project = await inspectProject(root);
  const candidates = sortCandidates(project.components.map((component) => ({
    id: `project/${normalizedName(component.name)}`,
    name: normalizedName(component.name),
    source: 'project',
    description: component.path,
    capabilities: inferCapabilities({ ...component, description: component.path }),
    dependencies: [],
    registryDependencies: [],
    installCommand: null,
    docsUrl: null,
    relevanceScore: 0,
    warnings: [],
  })), query, project);
  return result({ source: 'project', query, status: 'ok', candidates, warnings: project.warnings });
}

export async function buildOnlineSourceResult(source, query, root = '.') {
  const command = ONLINE_COMMANDS[source];
  if (!command) throw new Error(`Unsupported online source: ${source}`);

  const project = await inspectProject(root);
  const namespace = source === 'shadcn' ? null : `@${source}`;
  const warnings = [...project.warnings];
  if (namespace && !project.shadcn.registries.includes(namespace)) {
    warnings.push(`The ${namespace} registry is not configured in components.json. Configure it at ${REGISTRY_DOCS_URL}.`);
  }
  return result({
    source,
    query,
    status: 'requires-command',
    nextActions: [{ type: 'command', command: command(query), description: 'Run this official shadcn command to search the registry.' }],
    warnings,
  });
}
