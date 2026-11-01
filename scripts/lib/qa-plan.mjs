import { LEVELS, checkContrast, deriveTokenPairs, resolveColorReference } from './contrast.mjs';

const DEFAULT_VIEWPORTS = ['1440x900', '834x1112', '390x844', '320'];
const DEFAULT_STATES = ['loading', 'empty', 'error', 'success'];

const GLOBAL_CHECKS = [
  'The first viewport has one obvious focal point; the primary task is identifiable without reading every label.',
  'No page-level horizontal overflow at any target width.',
  'Hierarchy comes from type size, spacing, and contrast — not from stacked borders, shadows, or pills.',
  'Every color, radius, spacing, and type value maps to an existing project token, or the new value is recorded.',
  'The focus ring is visible on both the page canvas and raised surfaces.',
  'The keyboard path completes the primary task from the start of the document.',
  '200% zoom reflows without clipping, overlapping, or hidden actions.',
  'Reduced motion keeps state, hierarchy, and feedback while removing travel and loops.',
  'Loading, empty, error, and success states keep the same geometry.',
  'Images have intrinsic dimensions and fonts do not shift layout on load.',
  'Contrast holds in the rendered material: body text >= 4.5:1, large text >= 3:1, control boundaries >= 3:1.',
  'Long and localized labels wrap or truncate intentionally, with the full value still available.',
  'One primary action per view; secondary actions read as subordinate.',
  'No effect is required to understand the page.',
];

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : []);
const text = (value) => (typeof value === 'string' ? value.trim() : '');

function normalizeRegion(region, index) {
  const dataViz = isRecord(region?.dataViz) ? region.dataViz : null;
  const accessibility = isRecord(region?.accessibility) ? region.accessibility : {};
  return {
    id: text(region?.id) || `region-${index + 1}`,
    need: text(region?.need),
    selection: isRecord(region?.selection)
      ? { source: text(region.selection.source), component: text(region.selection.component) }
      : { source: '', component: '' },
    capabilities: strings(region?.capabilities),
    states: strings(region?.states),
    responsive: text(region?.responsive),
    accessibility: {
      keyboard: text(accessibility.keyboard),
      focus: text(accessibility.focus),
      semantics: text(accessibility.semantics),
    },
    dataViz: dataViz
      ? { question: text(dataViz.question), textAlternative: text(dataViz.textAlternative) }
      : null,
    emotionalRole: text(region?.emotionalRole),
    emotionalContribution: text(region?.emotionalContribution),
    performance: isRecord(region?.performance) ? region.performance : null,
  };
}

// Declared pairs come from the plan; project tokens add the pairs the theme implies. Both
// are evaluated the same way, so the checklist and the validator never disagree.
function declaredContrastEntries(designIntent, variables) {
  const declared = Array.isArray(designIntent.contrastPairs) ? designIntent.contrastPairs : [];
  const entries = [];
  for (const pair of declared) {
    if (!isRecord(pair) || typeof pair.foreground !== 'string' || typeof pair.background !== 'string') continue;
    const foreground = resolveColorReference(pair.foreground, variables);
    const background = resolveColorReference(pair.background, variables);
    entries.push({
      label: `${pair.foreground} on ${pair.background}`,
      foregroundValue: foreground.value,
      backgroundValue: background.value,
      kind: ['text', 'large', 'ui'].includes(pair.kind) ? pair.kind : 'text',
    });
  }
  return entries;
}

function evaluateContrastEntries(entries, level) {
  const results = [];
  for (const entry of entries) {
    const required = LEVELS[level][entry.kind];
    if (!entry.foregroundValue || !entry.backgroundValue) {
      results.push({
        label: entry.label,
        kind: entry.kind,
        required,
        ratio: null,
        pass: false,
        error: 'unresolved color or token',
      });
      continue;
    }
    const [checked] = checkContrast([{
      label: entry.label,
      foreground: entry.foregroundValue,
      background: entry.backgroundValue,
      kind: entry.kind,
    }], { level }).pairs;
    results.push(checked);
  }
  return results.sort((left, right) => (
    Number(left.pass) - Number(right.pass) || (left.ratio ?? 0) - (right.ratio ?? 0)
  ));
}

function buildContrastPairs(designIntent, designTokens) {
  const variables = Array.isArray(designTokens?.variables) ? designTokens.variables : [];
  const level = designIntent.contrastLevel === 'AAA' ? 'AAA' : 'AA';
  const entries = [];
  const seen = new Set();

  const add = (entry) => {
    const key = `${entry.foregroundValue}|${entry.backgroundValue}|${entry.kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push(entry);
  };

  for (const entry of declaredContrastEntries(designIntent, variables)) add(entry);
  for (const pair of deriveTokenPairs(variables)) {
    add({
      label: `${pair.foreground} on ${pair.background}`,
      foregroundValue: pair.foregroundValue,
      backgroundValue: pair.backgroundValue,
      kind: pair.kind,
    });
  }

  return { level, pairs: evaluateContrastEntries(entries, level) };
}

function viewportName(width) {
  if (width >= 1200) return 'desktop';
  if (width >= 768) return 'tablet';
  if (width >= 360) return 'mobile';
  return 'narrow';
}

function parseViewports(values) {
  const parsed = [];
  const used = new Set();
  for (const value of values) {
    // Accepts "1440x900", "1440×900", and a bare "320" (a narrow width is still a target).
    const match = String(value).match(/^(\d+)\s*(?:[x×]\s*(\d+))?$/i);
    const width = Number(match?.[1] ?? 0);
    const height = Number(match?.[2] ?? 800);
    const fallback = { name: 'desktop', width: 1440, height: 900 };
    const candidate = match && width > 0 && height > 0 ? { name: viewportName(width), width, height } : fallback;
    let name = candidate.name;
    let suffix = 2;
    while (used.has(name)) {
      name = `${candidate.name}-${suffix}`;
      suffix += 1;
    }
    used.add(name);
    parsed.push({ ...candidate, name });
  }
  return parsed;
}

export function buildQaPlan(plan, { designTokens, routes } = {}) {
  const document = isRecord(plan) ? plan : {};
  const designIntent = isRecord(document.designIntent) ? document.designIntent : {};
  const targets = isRecord(designIntent.visualQaTargets) ? designIntent.visualQaTargets : {};

  const viewports = strings(targets.viewports).length ? strings(targets.viewports) : [...DEFAULT_VIEWPORTS];
  const inspectedRoutes = strings(routes).length ? strings(routes) : ['/'];
  const regions = (Array.isArray(document.regions) ? document.regions : [])
    .filter(isRecord)
    .map(normalizeRegion);

  const declaredStates = new Set();
  for (const region of regions) {
    for (const state of region.states) declaredStates.add(state.toLowerCase());
  }
  const stateCoverage = declaredStates.size ? [...declaredStates] : [...DEFAULT_STATES];
  const contrast = buildContrastPairs(designIntent, designTokens);

  return {
    product: text(designIntent.product),
    primaryAction: text(designIntent.primaryAction),
    foundation: text(document.foundation),
    enhancer: text(document.enhancer) || 'none',
    density: text(designIntent.density),
    viewports,
    routes: inspectedRoutes,
    states: stateCoverage,
    regions,
    contrastLevel: contrast.level,
    contrastPairs: contrast.pairs,
    globalChecks: [...GLOBAL_CHECKS],
    successCriteria: strings(designIntent.successCriteria),
    emotionalQuestions: strings(isRecord(designIntent.emotionalIntent) ? designIntent.emotionalIntent.qaQuestions : []),
    emotionalSource: text(isRecord(designIntent.emotionalIntent) ? designIntent.emotionalIntent.source : ''),
    report: {
      engineering: '',
      rendered: '',
      emotional: '',
      status: 'incomplete',
      openIssues: '',
    },
  };
}

const checkboxLine = (label) => `- [ ] ${label}`;

export function renderQaMarkdown(qa) {
  const lines = ['# Visual QA plan', ''];

  lines.push(
    qa.product ? `Product: ${qa.product}` : 'Product: (not declared)',
    qa.primaryAction ? `Primary action: ${qa.primaryAction}` : 'Primary action: (not declared)',
    `Foundation: ${qa.foundation || '(not declared)'} · Enhancer: ${qa.enhancer}${qa.density ? ` · Density: ${qa.density}` : ''}`,
    `Success criteria: ${qa.successCriteria.length} · Emotional questions: ${qa.emotionalQuestions.length}`,
    '',
  );

  lines.push('## Review targets', '');
  for (const viewport of qa.viewports) lines.push(checkboxLine(viewport));
  lines.push(checkboxLine('200% zoom'), checkboxLine('keyboard path'), checkboxLine('reduced motion'));
  if (qa.emotionalSource === 'user-provided') lines.push(checkboxLine('reduced transparency / opaque fallback'));
  lines.push('');

  lines.push('## States to exercise', '');
  lines.push(qa.states.join(' · '), '');

  lines.push('## Region checks', '');
  if (qa.regions.length === 0) {
    lines.push('No regions declared in the plan.', '');
  }
  qa.regions.forEach((region, index) => {
    lines.push(`### ${index + 1}. ${region.id}${region.need ? ` — ${region.need}` : ''}`, '');
    if (region.selection.component) {
      lines.push(`- Selection: ${region.selection.source || 'unspecified'} / ${region.selection.component}`);
    }
    if (region.capabilities.length) lines.push(`- Capabilities: ${region.capabilities.join(', ')}`);
    if (region.states.length) lines.push(`- States: ${region.states.join(', ')}`);
    if (region.responsive) lines.push(`- Responsive: ${region.responsive}`);
    const a11y = region.accessibility;
    if (a11y.keyboard || a11y.focus || a11y.semantics) {
      lines.push(`- Accessibility: keyboard=${a11y.keyboard || '—'}; focus=${a11y.focus || '—'}; semantics=${a11y.semantics || '—'}`);
    }
    if (region.dataViz && (region.dataViz.question || region.dataViz.textAlternative)) {
      lines.push(`- Data question: ${region.dataViz.question || '—'} — text alternative: ${region.dataViz.textAlternative || '—'}`);
    }
    if (region.emotionalRole) {
      lines.push(`- Feeling: ${region.emotionalRole}${region.emotionalContribution ? ` — ${region.emotionalContribution}` : ''}`);
    }
    lines.push('');
    lines.push(checkboxLine('desktop'), checkboxLine('tablet'), checkboxLine('mobile'), checkboxLine('320px'));
    lines.push('');
  });

  if (qa.contrastPairs.length) {
    lines.push('## Contrast pairs', '');
    for (const pair of qa.contrastPairs) {
      const detail = pair.error ? pair.error : `${pair.ratio.toFixed(2)}:1`;
      lines.push(`- [${pair.pass ? 'x' : ' '}] ${pair.label} — ${detail} (${pair.kind} >= ${pair.required}:1)`);
    }
    lines.push('');
  }

  lines.push('## Global checks', '');
  for (const check of qa.globalChecks) lines.push(checkboxLine(check));
  lines.push('');

  if (qa.successCriteria.length) {
    lines.push('## Success criteria (answer each one)', '');
    for (const criterion of qa.successCriteria) lines.push(checkboxLine(criterion));
    lines.push('');
  }

  if (qa.emotionalQuestions.length) {
    lines.push('## Emotional checks (observations, not scores)', '');
    for (const question of qa.emotionalQuestions) lines.push(checkboxLine(question));
    lines.push('');
  }

  lines.push('## Report', '', '~~~text');
  lines.push(
    'Engineering checks: lint / typecheck / build',
    'Rendered checks: desktop / tablet / mobile / 320px / 200% zoom / keyboard / reduced motion',
    ...(qa.emotionalQuestions.length ? ['Emotional checks: observations per declared question'] : []),
    'Visual QA status: complete | incomplete',
    'Open issues: ',
  );
  lines.push('~~~', '');

  return `${lines.join('\n').trimEnd()}\n`;
}

export function renderPlaywrightSpec(qa) {
  const viewports = parseViewports(qa.viewports);
  const regions = qa.regions.map((region) => region.id);
  const routes = strings(qa.routes).length ? strings(qa.routes) : ['/'];
  const asyncStates = qa.states.filter((state) => DEFAULT_STATES.includes(state));
  const lines = [];

  lines.push('/* Generated by component-driven-frontend from the approved Component Plan.');
  lines.push(' * It automates only the repeatable parts of the rendered review; qa.md holds the rest.');
  lines.push(" * Requires the project's own @playwright/test install — nothing is installed here. */");
  lines.push("import { test, expect } from '@playwright/test';");
  lines.push('');
  lines.push(`const ROUTES = ${JSON.stringify(routes)}; // TODO: confirm every route under review (${qa.product || 'approved page'})`);
  lines.push(`const PRIMARY_ACTION = ${JSON.stringify(qa.primaryAction || 'the primary action')};`);
  lines.push('');
  lines.push("const slug = (route) => route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root';");
  lines.push('');
  lines.push('const VIEWPORTS = [');
  for (const viewport of viewports) {
    lines.push(`  { name: ${JSON.stringify(viewport.name)}, width: ${viewport.width}, height: ${viewport.height} },`);
  }
  lines.push('];');
  lines.push('');
  lines.push(`const REGIONS = ${JSON.stringify(regions)};`);
  lines.push('');

  lines.push(`test.describe(${JSON.stringify(`visual qa — ${qa.product || 'approved page'}`)}, () => {`);
  lines.push('  for (const route of ROUTES) {');
  lines.push('    test.describe(route, () => {');
  lines.push('      for (const viewport of VIEWPORTS) {');
  lines.push('        test.describe(viewport.name, () => {');
  lines.push('          test.use({ viewport: { width: viewport.width, height: viewport.height } });');
  lines.push('');
  lines.push("          test('renders without page-level horizontal overflow', async ({ page }) => {");
  lines.push('            await page.goto(route);');
  lines.push("            await page.waitForLoadState('networkidle');");
  lines.push('            const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);');
  lines.push("            expect(overflow, 'no page-level horizontal overflow').toBeLessThanOrEqual(1);");
  lines.push('            await page.screenshot({ path: `qa/${slug(route)}-${viewport.name}.png`, fullPage: true });');
  lines.push('          });');
  lines.push('');
  lines.push('          for (const region of REGIONS) {');
  lines.push('            test(`region ${region} stays inside the viewport`, async ({ page }) => {');
  lines.push('              await page.goto(route);');
  lines.push('              // Give each region wrapper `data-qa-region="<id>"` so this assertion can run.');
  lines.push('              const box = page.locator(`[data-qa-region="${region}"]`);');
  lines.push('              await expect(box).toHaveCount(1);');
  lines.push('              const overflow = await box.evaluate((element) => element.scrollWidth - element.clientWidth);');
  lines.push("              expect(overflow, 'region must not scroll horizontally').toBeLessThanOrEqual(1);");
  lines.push('            });');
  lines.push('          }');
  lines.push('        });');
  lines.push('      }');
  lines.push('');

  if (asyncStates.length) {
    lines.push(`      for (const state of ${JSON.stringify(asyncStates)}) {`);
    lines.push('        test(`state ${state} preserves geometry`, async ({ page }) => {');
    lines.push("          // TODO: drive the owning region into this state with the project's own fixtures.");
    lines.push('          await page.goto(route);');
    lines.push("          test.skip(true, `provide a fixture for the ${state} state`);");
    lines.push('        });');
    lines.push('      }');
    lines.push('');
  }

  lines.push("      test('keyboard path reaches the primary action', async ({ page }) => {");
  lines.push('        await page.goto(route);');
  lines.push("        // TODO: press Tab until the primary action is focused, then assert its accessible name.");
  lines.push("        const action = page.getByRole('button', { name: PRIMARY_ACTION });");
  lines.push('        await expect(action).toBeVisible();');
  lines.push('      });');
  lines.push('');
  lines.push("      test('reduced motion keeps state and feedback', async ({ page }) => {");
  lines.push("        await page.emulateMedia({ reducedMotion: 'reduce' });");
  lines.push('        await page.goto(route);');
  lines.push('        await page.screenshot({ path: `qa/${slug(route)}-reduced-motion.png`, fullPage: true });');
  lines.push('      });');
  lines.push('');
  lines.push("      test('axe scan', async ({ page }) => {");
  lines.push('        await page.goto(route);');
  lines.push('        // Enable when @axe-core/playwright is installed:');
  lines.push('        // const results = await new AxeBuilder({ page }).analyze();');
  lines.push('        // expect(results.violations).toEqual([]);');
  lines.push('      });');
  lines.push('    });');
  lines.push('  }');
  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

export { DEFAULT_VIEWPORTS };
