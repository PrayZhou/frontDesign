import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildQaPlan, renderPlaywrightSpec, renderQaMarkdown, DEFAULT_VIEWPORTS } from './qa-plan.mjs';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'visual-qa-plan.mjs');

const plan = {
  version: 1,
  designIntent: {
    product: 'Ops dashboard',
    primaryAction: 'Open the at-risk account list',
    density: 'comfortable',
    visualQaTargets: { viewports: ['1440x900', '390x844'] },
    successCriteria: ['A support lead finds the at-risk list in under ten seconds'],
    emotionalIntent: {
      source: 'user-provided',
      qaQuestions: ['Is one question dominant above the fold?'],
    },
  },
  foundation: 'shadcn',
  enhancer: 'magicui',
  regions: [
    {
      id: 'results',
      need: 'Compare accounts',
      capabilities: ['data', 'table', 'async', 'interactive'],
      selection: { source: 'project', component: 'data-table' },
      states: ['loading', 'empty', 'error', 'success'],
      responsive: 'Priority columns below 768px',
      accessibility: { keyboard: 'arrow keys move rows', focus: 'visible ring', semantics: 'role=grid' },
      dataViz: { question: 'Which accounts are at risk?', textAlternative: 'Sorted table of at-risk accounts' },
      emotionalRole: 'focal',
      emotionalContribution: 'steady, quiet table',
    },
  ],
};

test('the checklist is built from the declared intent', () => {
  const qa = buildQaPlan(plan);
  assert.equal(qa.product, 'Ops dashboard');
  assert.deepEqual(qa.viewports, ['1440x900', '390x844']);
  assert.equal(qa.regions.length, 1);
  assert.equal(qa.successCriteria.length, 1);
  assert.equal(qa.emotionalQuestions.length, 1);
  assert.equal(qa.emotionalSource, 'user-provided');
  assert.equal(qa.report.status, 'incomplete');
});

test('defaults appear when the plan declares no targets', () => {
  const qa = buildQaPlan({ version: 1, designIntent: { product: 'p' }, regions: [] });
  assert.deepEqual(qa.viewports, DEFAULT_VIEWPORTS);
  assert.ok(qa.globalChecks.length >= 10);
});

test('markdown carries every check and the honest report template', () => {
  const markdown = renderQaMarkdown(buildQaPlan(plan));
  assert.match(markdown, /^# Visual QA plan/m);
  assert.match(markdown, /### 1\. results — Compare accounts/);
  assert.match(markdown, /Which accounts are at risk\?/);
  assert.match(markdown, /role=grid/);
  assert.match(markdown, /- \[ \] 1440x900/);
  assert.match(markdown, /- \[ \] 200% zoom/);
  assert.match(markdown, /## Success criteria/);
  assert.match(markdown, /## Emotional checks/);
  assert.match(markdown, /Visual QA status: complete \| incomplete/);
});

test('an empty plan still renders a usable checklist', () => {
  const markdown = renderQaMarkdown(buildQaPlan({}));
  assert.match(markdown, /No regions declared in the plan\./);
  assert.match(markdown, /## Global checks/);
  assert.match(markdown, /## Review targets/);
  assert.match(markdown, /- \[ \] 320/);
});

test('--json emits the structured checklist', async () => {
  const file = path.join(os.tmpdir(), `cdf-qa-${process.pid}.json`);
  await fs.writeFile(file, JSON.stringify(plan));
  try {
    const { stdout } = await run(process.execPath, [cli, '--file', file, '--json']);
    const qa = JSON.parse(stdout);
    assert.equal(qa.regions[0].id, 'results');
    assert.equal(qa.regions[0].dataViz.question, 'Which accounts are at risk?');
    assert.deepEqual(qa.viewports, ['1440x900', '390x844']);
  } finally {
    await fs.rm(file, { force: true });
  }
});

test('--out writes markdown and a missing --file exits 2', async () => {
  const file = path.join(os.tmpdir(), `cdf-qa-in-${process.pid}.json`);
  const out = path.join(os.tmpdir(), `cdf-qa-out-${process.pid}.md`);
  await fs.writeFile(file, JSON.stringify(plan));
  try {
    await run(process.execPath, [cli, '--file', file, '--out', out]);
    const markdown = await fs.readFile(out, 'utf8');
    assert.match(markdown, /# Visual QA plan/);
  } finally {
    await fs.rm(file, { force: true });
    await fs.rm(out, { force: true });
  }

  await assert.rejects(
    run(process.execPath, [cli]),
    (error) => error.code === 2 && /--file is required/.test(error.stderr),
  );
});

const designTokens = {
  variables: [
    { name: '--background', value: '#ffffff' },
    { name: '--foreground', value: '#0a0a0a' },
    { name: '--primary', value: '#1d4ed8' },
    { name: '--primary-foreground', value: '#ffffff' },
    { name: '--border', value: '#ededed' },
  ],
};

test('theme tokens become contrast checks, failures first', () => {
  const qa = buildQaPlan(plan, { designTokens });
  assert.ok(qa.contrastPairs.length >= 3);
  assert.equal(qa.contrastPairs[0].pass, false);
  assert.equal(qa.contrastPairs[0].label, 'border on background');
  assert.ok(qa.contrastPairs.some((pair) => pair.label === 'foreground on background' && pair.pass));

  const markdown = renderQaMarkdown(qa);
  assert.match(markdown, /## Contrast pairs/);
  assert.match(markdown, /- \[ \] border on background/);
  assert.match(markdown, /- \[x\] foreground on background/);
});

test('declared pairs join the derived ones and unresolved references stay visible', () => {
  const declared = {
    ...plan,
    designIntent: {
      ...plan.designIntent,
      contrastPairs: [
        { foreground: 'foreground', background: 'background' },
        { foreground: '#111111', background: '#ffffff', kind: 'ui' },
        { foreground: 'missing-token', background: 'background' },
      ],
    },
  };
  const qa = buildQaPlan(declared, {
    designTokens: {
      variables: [
        { name: '--foreground', value: '#0a0a0a' },
        { name: '--background', value: '#ffffff' },
      ],
    },
  });

  const labels = qa.contrastPairs.map((pair) => pair.label);
  assert.ok(labels.includes('foreground on background'));
  assert.ok(labels.includes('#111111 on #ffffff'));
  const unresolved = qa.contrastPairs.find((pair) => pair.label.startsWith('missing-token'));
  assert.equal(unresolved.error, 'unresolved color or token');
  assert.equal(qa.contrastLevel, 'AA');
});

test('playwright spec carries viewports, regions, and honest TODOs', () => {
  const spec = renderPlaywrightSpec(buildQaPlan(plan));
  assert.match(spec, /import \{ test, expect \} from '@playwright\/test';/);
  assert.match(spec, /const ROUTES = \["\/"\];/);
  assert.match(spec, /const VIEWPORTS = \[/);
  assert.match(spec, /name: "desktop", width: 1440, height: 900/);
  assert.match(spec, /name: "mobile", width: 390, height: 844/);
  assert.match(spec, /const REGIONS = \["results"\];/);
  assert.match(spec, /data-qa-region/);
  assert.match(spec, /reducedMotion/);
  assert.match(spec, /test\.skip\(true/);
  assert.match(spec, /visual qa — Ops dashboard/);

  const defaults = renderPlaywrightSpec(buildQaPlan({}));
  assert.match(defaults, /name: "narrow", width: 320, height: 800/);
  assert.match(defaults, /name: "tablet", width: 834, height: 1112/);
});

test('multiple routes become one describe block each', () => {
  const spec = renderPlaywrightSpec(buildQaPlan(plan, { routes: ['/', '/accounts/[id]'] }));
  assert.match(spec, /const ROUTES = \["\/","\/accounts\/\[id\]"\];/);
  assert.match(spec, /for \(const route of ROUTES\)/);
  assert.match(spec, /test\.describe\(route/);
  assert.match(spec, /`qa\/\$\{slug\(route\)\}-\$\{viewport\.name\}\.png`/);
});

test('--emit playwright writes a spec and rejects an unknown emitter', async () => {
  const file = path.join(os.tmpdir(), `cdf-spec-in-${process.pid}.json`);
  const out = path.join(os.tmpdir(), `cdf-spec-${process.pid}.spec.ts`);
  await fs.writeFile(file, JSON.stringify(plan));
  try {
    await run(process.execPath, [cli, '--file', file, '--emit', 'playwright', '--out', out, '--route', '/', '--route', '/settings']);
    const spec = await fs.readFile(out, 'utf8');
    assert.match(spec, /@playwright\/test/);
    assert.match(spec, /const REGIONS = \["results"\];/);
    assert.match(spec, /const ROUTES = \["\/","\/settings"\];/);

    await assert.rejects(
      run(process.execPath, [cli, '--file', file, '--emit', 'pdf']),
      (error) => error.code === 2 && /--emit must be markdown or playwright/.test(error.stderr),
    );
  } finally {
    await fs.rm(file, { force: true });
    await fs.rm(out, { force: true });
  }
});

const gallery = {
  designIntent: {
    product: '三张照片',
    purpose: 'explore',
    coreTask: 'Follow the change in distance across the sequence',
    composition: {
      firstRead: 'The horizon in the opening photograph',
      readingOrder: ['Photograph', 'Place and date', 'Next viewpoint'],
      tradeoff: 'A single opening image defers comparison',
    },
  },
};

test('both review routes check how action icons fit their controls', () => {
  for (const input of [plan, gallery]) {
    const checklist = renderQaMarkdown(buildQaPlan(input));
    assert.match(checklist, /icon stroke and alignment/i);
    assert.match(checklist, /spacing around the label/i);
  }
});

test('control family review follows action briefs and declared controls', () => {
  const hasReview = input => buildQaPlan(input).globalChecks.some(check => check.includes('control family'));
  assert.ok(hasReview(plan));
  assert.ok(hasReview({ designIntent: { purpose: 'act' } }));
  assert.ok(hasReview({ ...gallery, regions: [{ capabilities: ['forms'] }] }));
  assert.equal(hasReview(gallery), false);
});

test('a standalone visual brief generates composition review without a CTA or invented states', () => {
  const qa = buildQaPlan(gallery);
  const markdown = renderQaMarkdown(qa);
  for (const observation of ['The horizon', 'Photograph → Place and date → Next viewpoint', 'defers comparison', 'change in distance']) {
    assert.ok(markdown.includes(observation), observation);
  }
  assert.doesNotMatch(markdown, /primary action|loading, empty|Foundation: \(not declared\)/i);
  assert.deepEqual(qa.states, []);
  const spec = renderPlaywrightSpec(qa);
  assert.doesNotMatch(spec, /keyboard path reaches the primary action|provide a fixture/);
  assert.match(spec, /axe scan/);
});

test('a content-led page keeps its actual interactive and async checks', () => {
  const qa = buildQaPlan({ ...plan, designIntent: { ...plan.designIntent, purpose: 'understand' } });
  const spec = renderPlaywrightSpec(qa);
  assert.match(spec, /keyboard path reaches the primary action/);
  assert.match(spec, /provide a fixture/);
});

test('malformed composition is diagnosed by the QA entry point', () => {
  assert.throws(() => buildQaPlan({ designIntent: { composition: { readingOrder: 'first' } } }), /readingOrder/);
});

test('sketch links stay with their actual candidates and selected direction in the review', () => {
  const qa = buildQaPlan({ designIntent: { ...gallery.designIntent, selectedStyleDirection: 'sheet',
    styleDirections: [
      { id: 'single', name: 'Single frame', sketch: 'first.html#frame' },
      { id: 'sheet', name: 'Contact sheet', sketch: 'second.html#grid' },
    ],
  } });
  const markdown = renderQaMarkdown(qa);
  assert.match(markdown, /Single frame[^\n]*first\.html#frame/);
  assert.match(markdown, /Contact sheet[^\n]*selected[^\n]*second\.html#grid/);
});

test('a static action brief keeps its keyboard check without inventing loading states', () => {
  const qa = buildQaPlan({ designIntent: { purpose: 'act', primaryAction: 'Call the desk' } });
  assert.deepEqual(qa.states, []);
  assert.match(renderPlaywrightSpec(qa), /keyboard path reaches the primary action/);
});

test('feedback on a standalone brief can finish without engineering or component evidence', () => {
  const markdown = renderQaMarkdown(buildQaPlan(gallery));
  assert.doesNotMatch(markdown, /No regions declared|existing project token|lint \/ typecheck \/ build|primary action/i);
  assert.match(markdown, /observed viewport/i);
  const implementation = renderQaMarkdown(buildQaPlan(plan));
  assert.match(implementation, /lint \/ typecheck \/ build/);
});

test('a tone revision carries its intended feeling and observable design choices into review', () => {
  const emotionalIntent = {
    source: 'inferred',
    goal: 'Know what can be recovered after the link expires',
    rationale: 'The user asked for a less mechanical error message.',
    carriers: { content: 'State that the current link expired.', interaction: 'Keep the resend action beside the message.' },
    avoid: ['Blaming the recipient'],
    qaQuestions: ['Is the next step visible beside the reason?'],
  };
  const qa = buildQaPlan({ designIntent: { purpose: 'act', primaryAction: 'Send a new link', emotionalIntent } });
  assert.deepEqual(qa.emotionalIntent, emotionalIntent);
  const report = renderQaMarkdown(qa);
  for (const phrase of [emotionalIntent.goal, emotionalIntent.rationale, 'inferred', ...Object.values(emotionalIntent.carriers),
    ...emotionalIntent.avoid, ...emotionalIntent.qaQuestions]) {
    assert.ok(report.includes(phrase), phrase);
  }
  assert.doesNotMatch(renderQaMarkdown(buildQaPlan({})), /## Emotional checks/);
});

test('the reviewer can distinguish the user’s requested feeling from its design interpretation', () => {
  const report = renderQaMarkdown(buildQaPlan({ designIntent: { emotionalIntent: {
    source: 'user-provided', userPhrase: '像有人接手了', goal: 'Recognize the person following up',
    carriers: { content: 'Place the owner next to the blocked shipment.' },
    qaQuestions: ['Can I find the owner?'],
  } } }));
  assert.ok(report.includes('像有人接手了'));
  assert.ok(report.includes('Recognize the person following up'));
});

test('a spatial region adds model review only to the relevant plans', () => {
  const spatial = { ...plan, regions: [{ ...plan.regions[0], capabilities: ['scene3d'] }] };
  assert.match(renderQaMarkdown(buildQaPlan(spatial)), /model silhouette/i);
  assert.doesNotMatch(renderQaMarkdown(buildQaPlan(gallery)), /model silhouette/i);
});
