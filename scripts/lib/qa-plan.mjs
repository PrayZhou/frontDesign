import { isReadingPurpose, visualIntentErrors } from './visual-intent.mjs';
import { LEVELS, checkContrast, deriveTokenPairs, resolveColorReference } from './contrast.mjs';

const DEFAULT_VIEWPORTS = ['1440x900', '834x1112', '390x844', '320'];
const DEFAULT_STATES = ['loading', 'empty', 'error', 'success'];

const GLOBAL_CHECKS = [
  'The first viewport has one obvious focal point; the primary task is identifiable without reading every label.',
  'No page-level horizontal overflow at any target width.',
  'Try removing a repeated explanation or nested panel. Keep the first task and essential feedback visible at phone width.',
  'Every color, radius, spacing, and type value maps to an existing project token, or the new value is recorded.',
  'The focus ring is visible on both the page canvas and raised surfaces.',
  '200% zoom reflows without clipping, overlapping, or hidden actions.',
  'Compare title, body and metadata in their actual columns at each width. Enlarge browser text and open a detail view; labels wrap and controls remain reachable.',
  'Reduced motion keeps state, hierarchy, and feedback while removing travel and loops.',
  'Images have intrinsic dimensions and fonts do not shift layout on load.',
  'Contrast holds in the rendered material: body text >= 4.5:1, large text >= 3:1, control boundaries >= 3:1.',
  'Long and localized labels wrap or truncate intentionally, with the full value still available.',
  'No effect is required to understand the page.',
];

const BRIEF_CHECKS = [
  'Compare the first visible subject with the intended first read.',
  'Trace the reading order across the opening and its next section. Check that the gap separates ideas and the supporting detail stays with its subject.',
  'Inspect the actual title breaks, image crops and caption grouping at the observed viewport.',
  'Identify any content or context lost when the layout narrows.',
  'Read a full paragraph and its caption at the available widths. Check line length, line spacing and the size of the supporting type.',
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
  const errors = visualIntentErrors(designIntent);
  if (errors.length) throw new Error(errors.map(error => error.path + ': ' + error.message).join('\n'));
  const emotion = isRecord(designIntent.emotionalIntent) ? designIntent.emotionalIntent : null;
  const reading = isReadingPurpose(designIntent.purpose);
  const standalone = Boolean(designIntent.purpose) && document.version === undefined && document.foundation === undefined;
  const targets = isRecord(designIntent.visualQaTargets) ? designIntent.visualQaTargets : {};

  const viewports = strings(targets.viewports).length ? strings(targets.viewports) : [...DEFAULT_VIEWPORTS];
  const inspectedRoutes = strings(routes).length ? strings(routes) : ['/'];
  const regions = (Array.isArray(document.regions) ? document.regions : [])
    .filter(isRecord)
    .map(normalizeRegion);

  const declaredStates = new Set(designIntent.purpose ? strings(targets.states).map(state => state.toLowerCase()) : []);
  for (const region of regions) {
    for (const state of region.states) declaredStates.add(state.toLowerCase());
  }
  const asyncRegion = regions.some(region => region.capabilities.includes('async') || region.capabilities.includes('data'));
  const fallbackStates = designIntent.purpose && !asyncRegion ? [] : DEFAULT_STATES;
  const stateCoverage = declaredStates.size ? [...declaredStates] : [...fallbackStates];
  const globalChecks = standalone ? [...BRIEF_CHECKS] : [...GLOBAL_CHECKS];
  globalChecks.push('For controls with a mark, inspect icon stroke and alignment, spacing around the label and edge padding at actual size. Try hover, keyboard focus and reduced motion to check how the mark responds.');
  if (designIntent.purpose === 'act' || text(designIntent.primaryAction) ||
      regions.some(region => region.capabilities.some(capability => ['forms', 'controls', 'interactive'].includes(capability)))) {
    globalChecks.push('Review the control family in context. Which product detail shaped its buttons, fields or switches? Try the controls present with a real value and keyboard focus; check that selection remains legible without color.');
  }
  if (regions.some(region => region.capabilities.includes('scene3d'))) {
    globalChecks.push('Inspect the model silhouette at phone and desktop widths. Change the view or selection and identify the product detail it reveals.');
    globalChecks.push('Exercise keyboard and touch controls, reduced motion, a missing renderer and context loss. Check that the underlying task works with the poster and that hidden scenes stop animating.');
  }
  if (reading) globalChecks.push('Check the sequence, captions and reading order at desktop and narrow widths.');
  if (!reading || text(designIntent.primaryAction)) {
    globalChecks.push('The keyboard path completes the primary task from the start of the document.');
    globalChecks.push('One primary action per view; secondary actions read as subordinate.');
  }
  if (stateCoverage.some(state => DEFAULT_STATES.includes(state))) {
    globalChecks.push('Declared asynchronous states keep the reading position stable.');
  }
  const contrast = buildContrastPairs(designIntent, designTokens);

  return {
    reviewType: standalone ? 'brief' : 'component',
    product: text(designIntent.product),
    purpose: text(designIntent.purpose),
    coreTask: text(designIntent.coreTask),
    composition: designIntent.composition ?? null,
    sketches: (Array.isArray(designIntent.styleDirections) ? designIntent.styleDirections : [])
      .filter(direction => text(direction?.sketch))
      .map(direction => ({
        name: text(direction.name) || text(direction.id),
        reference: text(direction.sketch),
        selected: Boolean(direction.id && direction.id === designIntent.selectedStyleDirection),
      })),
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
    globalChecks,
    successCriteria: strings(designIntent.successCriteria),
    emotionalIntent: emotion,
    emotionalQuestions: strings(emotion?.qaQuestions),
    emotionalSource: text(emotion?.source),
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
    ...(qa.purpose ? [`Purpose: ${qa.purpose}`] : []),
    ...(qa.coreTask ? [`Intended outcome: ${qa.coreTask}`] : []),
    ...(qa.primaryAction ? [`Primary action: ${qa.primaryAction}`] : []),
    ...(qa.foundation ? [`Foundation: ${qa.foundation} · Enhancer: ${qa.enhancer}${qa.density ? ` · Density: ${qa.density}` : ''}`] : []),
    `Success criteria: ${qa.successCriteria.length} · Emotional questions: ${qa.emotionalQuestions.length}`,
    '',
  );

  if (qa.composition) {
    lines.push('## Composition review', '',
      checkboxLine('First read — ' + qa.composition.firstRead),
      checkboxLine('Reading order — ' + qa.composition.readingOrder.join(' → ')),
      checkboxLine('Recheck the tradeoff — ' + qa.composition.tradeoff), '',
      'Record the viewport, visible evidence, revision and result of the next capture.', '');
  }

  if (qa.sketches?.length) {
    lines.push('## Sketch references', '');
    for (const sketch of qa.sketches) {
      lines.push(`- ${sketch.name}${sketch.selected ? ' (selected)' : ''} — ${sketch.reference}`);
    }
    lines.push('');
  }

  lines.push('## Review targets', '');
  for (const viewport of qa.viewports) lines.push(checkboxLine(viewport));
  if (qa.reviewType === 'brief') {
    lines.push('', 'Record which views were available. Proposed checks may be left open.');
  } else {
    lines.push(checkboxLine('200% zoom'), checkboxLine('keyboard path'), checkboxLine('reduced motion'));
  }
  if (qa.emotionalSource === 'user-provided') lines.push(checkboxLine('reduced transparency / opaque fallback'));
  lines.push('');

  if (qa.states.length) lines.push('## States to exercise', '', qa.states.join(' · '), '');

  if (qa.regions.length || qa.reviewType !== 'brief') lines.push('## Region checks', '');
  if (qa.regions.length === 0 && qa.reviewType !== 'brief') {
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

  const emotion = qa.emotionalIntent;
  if (emotion || qa.emotionalQuestions.length) {
    lines.push('## Emotional checks (observations, not scores)', '');
    if (qa.emotionalSource === 'user-provided' && text(emotion?.userPhrase)) {
      lines.push(`User’s words: ${emotion.userPhrase}`, '');
    }
    if (text(emotion?.goal)) {
      lines.push(`Intended experience (${qa.emotionalSource || 'inferred'}): ${emotion.goal}`, '');
    }
    if (text(emotion?.rationale)) lines.push(emotion.rationale, '');
    if (isRecord(emotion?.carriers)) {
      for (const [layer, cue] of Object.entries(emotion.carriers)) {
        if (text(cue)) lines.push(checkboxLine(`${layer} — ${cue}`));
      }
      lines.push('');
    }
    if (strings(emotion?.avoid).length) lines.push('Avoid: ' + emotion.avoid.join(' · '), '');
    for (const question of qa.emotionalQuestions) lines.push(checkboxLine(question));
    lines.push('', 'Describe what changed at this moment. Record visitor reactions only when observed.', '');
  }

  lines.push('## Report', '', '~~~text');
  lines.push(
    ...(qa.reviewType === 'brief'
      ? ['Observed viewport and material:', 'Visible issue and effect:', 'Revision or proposed follow-up:']
      : ['Engineering checks: lint / typecheck / build',
        'Rendered checks: desktop / tablet / mobile / 320px / 200% zoom / keyboard / reduced motion']),
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
  lines.push("import { createRequire } from 'node:module';");
  lines.push("import { test, expect } from '@playwright/test';");
  lines.push('');
  lines.push(`const ROUTES = ${JSON.stringify(routes)};`);
  lines.push(`const PRIMARY_ACTION = ${JSON.stringify(qa.primaryAction || '')};`);
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
  if (qa.primaryAction || !isReadingPurpose(qa.purpose)) lines.push(`
          test('keyboard path reaches the primary action', async ({ page }) => {
            test.skip(!PRIMARY_ACTION, 'Declare designIntent.primaryAction to check keyboard access.');
            await page.goto(route);
            const name = { name: PRIMARY_ACTION, exact: true };
            const action = page.getByRole('button', name).or(page.getByRole('link', name));
            await expect(action).toHaveCount(1);
            await expect(action).toBeVisible();
            await expect.poll(async () => {
              await page.keyboard.press('Tab');
              return action.evaluate(element => element.matches(':focus'));
            }, { message: 'Tab must reach the named primary action', timeout: 8000, intervals: [10] }).toBe(true);
            await expect(action).toBeFocused();
          });`);
  lines.push(`
          test('axe scan', async ({ page }, testInfo) => {
            const projectRequire = createRequire(testInfo.file);
            try {
              projectRequire.resolve('@axe-core/playwright');
            } catch (error) {
              if (!(error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND'
                && error.message.startsWith("Cannot find module '@axe-core/playwright'"))) throw error;
              test.skip(true, 'Install @axe-core/playwright in the project to enable scanning.');
              return;
            }
            const { AxeBuilder } = projectRequire('@axe-core/playwright');
            await page.goto(route);
            const { violations } = await new AxeBuilder({ page }).analyze();
            expect(violations).toEqual([]);
          });`);
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

  lines.push("      test('reduced motion keeps state and feedback', async ({ page }) => {");
  lines.push("        await page.emulateMedia({ reducedMotion: 'reduce' });");
  lines.push('        await page.goto(route);');
  lines.push('        await page.screenshot({ path: `qa/${slug(route)}-reduced-motion.png`, fullPage: true });');
  lines.push('      });');
  lines.push('');
  lines.push('    });');
  lines.push('  }');
  lines.push('});');
  lines.push('');

  return lines.join('\n');
}

export { DEFAULT_VIEWPORTS };
