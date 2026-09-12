# Inspiration Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-channel, three-tier inspiration/component search capability to the `component-driven-frontend` skill, backed by one offline script and one normative reference doc.

**Architecture:** A single offline lib module (`inspiration-planner.mjs`) owns the tier data, search-plan generation, evidence normalization, and tier-violation audit. A thin CLI (`inspiration-search.mjs`) exposes three modes. A new reference doc defines the protocol; `SKILL.md` and four existing references link to it. No schema or validator changes.

**Tech Stack:** Node.js ESM (`.mjs`), `node:test` + `node:assert/strict` for tests, zero external dependencies. Node v26 is installed.

**Spec:** `docs/superpowers/specs/2026-09-13-inspiration-search-design.md`

## Global Constraints

- Node ESM only. All new code uses `.mjs` and `import`; no `require`, no external npm packages.
- The scripts are offline. They must never perform network access. Web search is performed by the agent, not the script.
- Scripts write nothing except the explicit `--out <file>` target of `--normalize`.
- Exit codes follow the existing convention: `0` success, `1` policy violation (audit), `2` usage or parse error.
- Internal tier identifiers are uppercase `T1`, `T2`, `T3`. Input accepts lowercase and comma-separated values and normalizes to uppercase.
- Tier rules are fixed: T1 = official/registry (may produce component candidates); T2 = real products / official design-system cases (design evidence only); T3 = inspiration aggregators (transferable principles only, never a selection candidate).
- No change to `schemas/component-plan.schema.json` or `scripts/lib/plan-validator.mjs`.
- This directory is **not a git repository** (`git rev-parse` fails). Therefore commit steps are replaced by verification checkpoints. Do not run `git init` unless the user asks.
- Every new file must be linked from `SKILL.md` or from a doc that `SKILL.md` links. Unreferenced assets are treated as redundant.
- Reuse existing helpers: `scripts/lib/cli.mjs` (`parseArgs`, `printJson`) and `scripts/lib/project-inspector.mjs` (`readJsonFile`).
- The `examples/` directory was removed from this workspace (redundant asset) before
  implementation began. Regression evidence comes from the test suite, not from example
  plans. Do not recreate `examples/`.
- Do not change existing behavior of `query-components.mjs`, `inspect-project.mjs`, or `validate-component-plan.mjs`.

---

## File Structure

Create:

- `scripts/lib/inspiration-planner.mjs` — tier data + `searchPlan` + `normalizeCaptured` + `auditPlan`. One responsibility: all inspiration/search policy logic.
- `scripts/lib/inspiration-planner.test.mjs` — unit tests for the lib.
- `scripts/inspiration-search.mjs` — CLI entry point over the lib.
- `scripts/inspiration-search.test.mjs` — CLI integration tests.
- `references/inspiration-search.md` — the normative protocol.

Modify:

- `SKILL.md` — Route step 1 (insert `1a`), Route step 3 (insert `3a`), Route boundary, Route intro link list.
- `references/research-ingestion.md` — cross-link.
- `references/visual-reference-cards.md` — cross-link.
- `references/source-adapters.md` — cross-link.
- `references/component-selection.md` — prohibition note.

---

### Task 1: Tier model and search-plan generation

**Files:**
- Create: `scripts/lib/inspiration-planner.mjs`
- Test: `scripts/lib/inspiration-planner.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `TIER_SITES: Array<{ site: string, tier: 'T1'|'T2'|'T3', allowedUse: string[], forbidden: string[] }>`
  - `searchPlan({ channel: 'inspiration'|'components', brief?: string, tiers?: string|string[], intent?: object }): { channel, status, tiers, queries: Array<{text,tier,purpose}>, targets: Array<{site,tier,allowedUse,forbidden}>, constraints: string[] }`

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/inspiration-planner.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { searchPlan, TIER_SITES } from './inspiration-planner.mjs';

test('inspiration channel plans T2 and T3 by default', () => {
  const plan = searchPlan({ channel: 'inspiration', brief: 'operations dashboard for support teams' });
  assert.equal(plan.status, 'ok');
  assert.deepEqual(plan.tiers, ['T2', 'T3']);
  assert.ok(plan.targets.every((target) => target.tier !== 'T1'));
  assert.ok(plan.queries.length > 0);
  assert.ok(plan.queries.every((query) => ['T2', 'T3'].includes(query.tier)));
});

test('components channel plans T1 only and marks candidates', () => {
  const plan = searchPlan({ channel: 'components', brief: 'data table with filters' });
  assert.deepEqual(plan.tiers, ['T1']);
  assert.ok(plan.targets.every((target) => target.tier === 'T1'));
  assert.ok(plan.queries.every((query) => query.purpose === 'component-candidate'));
});

test('planning is deterministic and ignores stopwords', () => {
  const first = searchPlan({ channel: 'inspiration', brief: 'a dashboard for the team' });
  const second = searchPlan({ channel: 'inspiration', brief: 'a dashboard for the team' });
  assert.deepEqual(first, second);
  assert.ok(first.queries.every((query) => !query.text.startsWith('the ')));
});

test('unknown channel and tier are rejected', () => {
  assert.throws(() => searchPlan({ channel: 'nope', brief: 'x' }), /Unknown channel/);
  assert.throws(() => searchPlan({ channel: 'inspiration', brief: 'x', tiers: 'T9' }), /Unknown tier/);
});

test('T3 targets carry the no-candidate prohibition', () => {
  const target = TIER_SITES.find((entry) => entry.tier === 'T3');
  assert.ok(target.forbidden.includes('component-candidate'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/lib/inspiration-planner.test.mjs`
Expected: FAIL — `Cannot find module './inspiration-planner.mjs'`.

- [ ] **Step 3: Write the minimal implementation**

Create `scripts/lib/inspiration-planner.mjs`:

```js
const TIER_ORDER = ['T1', 'T2', 'T3'];
const CHANNEL_TIERS = { inspiration: ['T2', 'T3'], components: ['T1'] };
const CHANNEL_PURPOSE = { inspiration: 'style-direction', components: 'component-candidate' };
const TIER_QUERY_SUFFIX = {
  T1: 'component library',
  T2: 'real product ui',
  T3: 'design inspiration',
};
const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'our',
  'are', 'was', 'were', 'has', 'have', 'not', 'but', 'its', 'their', 'they',
]);
const MAX_QUERY_TOKENS = 3;
const MAX_QUERIES = 6;

export const TIER_SITES = [
  { site: 'ui.shadcn.com', tier: 'T1', allowedUse: ['component-candidate'], forbidden: ['memory-assertion'] },
  { site: '21st.dev', tier: 'T1', allowedUse: ['component-candidate'], forbidden: ['memory-assertion'] },
  { site: 'magicui.design', tier: 'T1', allowedUse: ['component-candidate'], forbidden: ['memory-assertion'] },
  { site: 'ui.aceternity.com', tier: 'T1', allowedUse: ['component-candidate'], forbidden: ['memory-assertion'] },
  { site: 'originui.com', tier: 'T1', allowedUse: ['component-candidate'], forbidden: ['memory-assertion'] },
  { site: 'heroui.com', tier: 'T1', allowedUse: ['component-candidate'], forbidden: ['memory-assertion'] },
  { site: 'mantine.dev', tier: 'T1', allowedUse: ['component-candidate'], forbidden: ['memory-assertion'] },
  { site: 'mui.com', tier: 'T1', allowedUse: ['component-candidate'], forbidden: ['memory-assertion'] },
  { site: 'ant.design', tier: 'T1', allowedUse: ['component-candidate'], forbidden: ['memory-assertion'] },
  { site: 'mobbin.com', tier: 'T2', allowedUse: ['design-evidence'], forbidden: ['copy-layout', 'copy-brand', 'copy-copy', 'copy-asset', 'component-candidate'] },
  { site: 'figma.com/community', tier: 'T2', allowedUse: ['design-evidence'], forbidden: ['copy-asset', 'component-candidate'] },
  { site: 'dribbble.com', tier: 'T3', allowedUse: ['transferable-principle'], forbidden: ['copy-layout', 'copy-brand', 'copy-copy', 'copy-asset', 'component-candidate'] },
  { site: 'behance.net', tier: 'T3', allowedUse: ['transferable-principle'], forbidden: ['copy-layout', 'copy-brand', 'copy-copy', 'copy-asset', 'component-candidate'] },
  { site: 'awwwards.com', tier: 'T3', allowedUse: ['transferable-principle'], forbidden: ['copy-layout', 'copy-brand', 'copy-copy', 'copy-asset', 'component-candidate'] },
  { site: 'godly.website', tier: 'T3', allowedUse: ['transferable-principle'], forbidden: ['copy-layout', 'copy-brand', 'copy-copy', 'copy-asset', 'component-candidate'] },
  { site: 'land-book.com', tier: 'T3', allowedUse: ['transferable-principle'], forbidden: ['copy-layout', 'copy-brand', 'copy-copy', 'copy-asset', 'component-candidate'] },
  { site: 'refero.design', tier: 'T3', allowedUse: ['transferable-principle'], forbidden: ['copy-layout', 'copy-brand', 'copy-copy', 'copy-asset', 'component-candidate'] },
  { site: 'layers.to', tier: 'T3', allowedUse: ['transferable-principle'], forbidden: ['copy-layout', 'copy-brand', 'copy-copy', 'copy-asset', 'component-candidate'] },
];

function normalizeTiers(tiers) {
  if (tiers === undefined || tiers === null || tiers === '') return null;
  const list = Array.isArray(tiers) ? tiers : String(tiers).split(',');
  const cleaned = [];
  for (const value of list) {
    const tier = String(value).trim().toUpperCase();
    if (!tier) continue;
    if (!TIER_ORDER.includes(tier)) throw new Error(`Unknown tier: ${value}`);
    if (!cleaned.includes(tier)) cleaned.push(tier);
  }
  if (cleaned.length === 0) return null;
  return cleaned.sort((left, right) => TIER_ORDER.indexOf(left) - TIER_ORDER.indexOf(right));
}

export function tokenizeBrief(brief = '') {
  const raw = String(brief)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/);
  const tokens = [];
  for (const token of raw) {
    if (token.length < 3 || STOPWORDS.has(token) || tokens.includes(token)) continue;
    tokens.push(token);
    if (tokens.length === MAX_QUERY_TOKENS) break;
  }
  return tokens;
}

function buildConstraints(tiers) {
  const constraints = [
    'Distill transferable principles; never copy layout, brand, copy, or assets.',
    'Record URL, publisher, retrieval time, and license note for every source.',
    'Do not treat an unexecuted search or a remembered item as evidence.',
  ];
  if (tiers.includes('T1')) constraints.push('T1 candidates still require verification against official docs or a registry.');
  if (tiers.includes('T2')) constraints.push('T2 sources are design evidence only; they must not become selection candidates.');
  if (tiers.includes('T3')) constraints.push('T3 sources must never become selection candidates.');
  return constraints;
}

export function searchPlan({ channel, brief = '', tiers, intent } = {}) {
  const purpose = CHANNEL_PURPOSE[channel];
  if (!purpose) throw new Error(`Unknown channel: ${channel}. Use inspiration or components.`);

  const requestedTiers = normalizeTiers(tiers) ?? [...CHANNEL_TIERS[channel]];
  const designIntent = intent && typeof intent === 'object' ? intent.designIntent : undefined;
  const extra = [
    designIntent?.visualDirection ?? '',
    ...(Array.isArray(designIntent?.principles) ? designIntent.principles : []),
  ].join(' ');
  const tokens = tokenizeBrief(`${brief} ${extra}`);

  const queries = [];
  for (const tier of requestedTiers) {
    for (const token of tokens) {
      if (queries.length >= MAX_QUERIES) break;
      queries.push({ text: `${token} ${TIER_QUERY_SUFFIX[tier]}`, tier, purpose });
    }
  }

  const targets = TIER_SITES
    .filter((entry) => requestedTiers.includes(entry.tier))
    .map((entry) => ({
      site: entry.site,
      tier: entry.tier,
      allowedUse: [...entry.allowedUse],
      forbidden: [...entry.forbidden],
    }));

  return { channel, status: 'ok', tiers: requestedTiers, queries, targets, constraints: buildConstraints(requestedTiers) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/lib/inspiration-planner.test.mjs`
Expected: PASS — 5 tests.

- [ ] **Step 5: Checkpoint**

Run: `node -e "import('./scripts/lib/inspiration-planner.mjs').then(m => console.log(JSON.stringify(m.searchPlan({channel:'components',brief:'data table'}), null, 2)))"`
Expected: prints a plan with `"tiers": ["T1"]`.

---

### Task 2: Evidence normalization

**Files:**
- Modify: `scripts/lib/inspiration-planner.mjs` (append)
- Test: `scripts/lib/inspiration-planner.test.mjs` (append)

**Interfaces:**
- Consumes: `TIER_SITES` (Task 1), `validateComponentPlan` from `./plan-validator.mjs` (existing, test-only).
- Produces: `normalizeCaptured(captured: { references: Array<{ url, publisher, claim, tier, confidence?, type?, capturedAt?, freshness?, appliesWhen?, constraints?, license? }> }): Array<{ id, type, source, claim, confidence, capturedAt, freshness?, constraints, appliesWhen?, notes? }>` — records conform to `schemas/component-plan.schema.json → $defs/evidence`.

- [ ] **Step 1: Write the failing test**

Append to `scripts/lib/inspiration-planner.test.mjs`:

```js
import { normalizeCaptured } from './inspiration-planner.mjs';
import { validateComponentPlan } from './plan-validator.mjs';

const captured = {
  references: [
    {
      url: 'https://dribbble.com/shots/1',
      publisher: 'Dribbble',
      tier: 'T3',
      claim: 'Dashboard hierarchy leads with one dominant task above the fold.',
      confidence: 'medium',
      capturedAt: '2026-09-13',
      license: 'All rights reserved',
      appliesWhen: ['dashboard'],
    },
    {
      url: 'https://ui.shadcn.com/docs/components/data-table',
      publisher: 'shadcn',
      tier: 'T1',
      claim: 'Data table composes through a root and toolbar parts.',
      capturedAt: '2026-09-13',
    },
  ],
};

test('normalizeCaptured maps tiers to evidence records', () => {
  const records = normalizeCaptured(captured);
  assert.equal(records.length, 2);
  assert.equal(records[0].id, 'insp-001');
  assert.equal(records[0].type, 'observed-pattern');
  assert.equal(records[1].type, 'official-doc');
  assert.equal(records[1].confidence, 'medium');
  assert.match(records[0].notes, /do not copy/);
});

test('normalized records satisfy the plan validator', () => {
  const plan = {
    version: 1,
    designIntent: {
      product: 'Operations dashboard',
      audience: 'Support teams',
      coreTask: 'Review account health',
      visualDirection: 'Calm information-forward workspace',
      density: 'comfortable',
      principles: ['Make health scannable'],
      evidence: normalizeCaptured(captured),
    },
    foundation: 'shadcn',
    enhancer: null,
    dependencies: [],
    regions: [
      {
        id: 'summary',
        need: 'See account health',
        capabilities: ['data'],
        selection: { source: 'foundation', component: 'card' },
        reason: 'Reuse the foundation card',
        states: ['loading', 'empty', 'error', 'success'],
        responsive: 'Single column on mobile',
        accessibility: { semantics: 'labelled region' },
      },
    ],
  };
  const result = validateComponentPlan(plan);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('missing required reference fields are rejected', () => {
  assert.throws(() => normalizeCaptured({ references: [{ tier: 'T3' }] }), /url is required/);
  assert.throws(() => normalizeCaptured({ references: [] }), /non-empty array/);
  assert.throws(() => normalizeCaptured({ references: [{ url: 'u', publisher: 'p', claim: 'c', tier: 'T9' }] }), /must be one of T1, T2, T3/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/lib/inspiration-planner.test.mjs`
Expected: FAIL — `normalizeCaptured is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to `scripts/lib/inspiration-planner.mjs`:

```js
const TIER_EVIDENCE_TYPE = { T1: 'official-doc', T2: 'observed-pattern', T3: 'observed-pattern' };
const VALID_EVIDENCE_TYPES = new Set(['official-doc', 'observed-pattern', 'screenshot']);
const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);
const VALID_FRESHNESS = new Set(['current', 'needs-review', 'historical']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeReference(reference, index) {
  if (!reference || typeof reference !== 'object' || Array.isArray(reference)) {
    throw new Error(`captured.references[${index}] must be an object.`);
  }
  const tier = String(reference.tier ?? '').toUpperCase();
  if (!TIER_ORDER.includes(tier)) {
    throw new Error(`captured.references[${index}].tier must be one of T1, T2, T3.`);
  }
  for (const field of ['url', 'publisher', 'claim']) {
    if (!nonEmptyString(reference[field])) {
      throw new Error(`captured.references[${index}].${field} is required.`);
    }
  }
  const confidence = reference.confidence ?? 'medium';
  if (!VALID_CONFIDENCE.has(confidence)) {
    throw new Error(`captured.references[${index}].confidence must be high, medium, or low.`);
  }
  const type = reference.type ?? TIER_EVIDENCE_TYPE[tier];
  if (!VALID_EVIDENCE_TYPES.has(type)) {
    throw new Error(`captured.references[${index}].type must be official-doc, observed-pattern, or screenshot.`);
  }
  const freshness = reference.freshness ?? 'current';
  if (!VALID_FRESHNESS.has(freshness)) {
    throw new Error(`captured.references[${index}].freshness must be current, needs-review, or historical.`);
  }

  const matched = TIER_SITES.find((entry) => entry.tier === tier && reference.url.includes(entry.site));
  const allowed = matched ? matched.allowedUse : ['transferable-principle'];
  const constraints = Array.isArray(reference.constraints) && reference.constraints.some(nonEmptyString)
    ? reference.constraints.filter(nonEmptyString)
    : [`Tier ${tier}: ${allowed.join(', ')} only.`];

  const record = {
    id: `insp-${String(index + 1).padStart(3, '0')}`,
    type,
    source: `${reference.publisher.trim()} — ${reference.url.trim()}`,
    claim: reference.claim.trim(),
    confidence,
    capturedAt: nonEmptyString(reference.capturedAt) ? reference.capturedAt.trim() : new Date().toISOString().slice(0, 10),
    freshness,
    constraints,
  };

  const appliesWhen = Array.isArray(reference.appliesWhen) ? reference.appliesWhen.filter(nonEmptyString) : [];
  if (appliesWhen.length) record.appliesWhen = appliesWhen;

  const notes = [];
  if (nonEmptyString(reference.license)) notes.push(`license: ${reference.license.trim()}`);
  if (tier === 'T2' || tier === 'T3') notes.push('reference only — do not copy layout, brand, copy, or assets');
  if (notes.length) record.notes = notes.join('; ');

  return record;
}

export function normalizeCaptured(captured) {
  const references = captured?.references;
  if (!Array.isArray(references) || references.length === 0) {
    throw new Error('captured.references must be a non-empty array.');
  }
  return references.map((reference, index) => normalizeReference(reference, index));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/lib/inspiration-planner.test.mjs`
Expected: PASS — 8 tests.

- [ ] **Step 5: Checkpoint**

Run: `node --test scripts/lib/inspiration-planner.test.mjs`
Expected: PASS — 8 tests, including `normalized records satisfy the plan validator`, which proves a normalized-evidence plan still passes `validateComponentPlan`.

---

### Task 3: Tier-violation audit

**Files:**
- Modify: `scripts/lib/inspiration-planner.mjs` (append)
- Test: `scripts/lib/inspiration-planner.test.mjs` (append)

**Interfaces:**
- Consumes: `TIER_SITES` (Task 1).
- Produces: `auditPlan(plan: object): { valid: boolean, violations: Array<{ code, path, message }> }`.

- [ ] **Step 1: Write the failing test**

Append to `scripts/lib/inspiration-planner.test.mjs`:

```js
import { auditPlan } from './inspiration-planner.mjs';
```

Note on semantics: `auditPlan` reports **at most one violation per region**. Without the
`break` in the implementation below, a region whose source is `t2` would match both T2
entries and a `T3` source would match all seven T3 entries, producing 9 violations where the
tests below require 2. The `break` is required for the tests to pass.


- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/lib/inspiration-planner.test.mjs`
Expected: FAIL — `auditPlan is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to `scripts/lib/inspiration-planner.mjs`:

```js
const RESTRICTED_SITES = TIER_SITES.filter((entry) => entry.tier !== 'T1');

export function auditPlan(plan) {
  const violations = [];
  const regions = Array.isArray(plan?.regions) ? plan.regions : [];

  regions.forEach((item, index) => {
    const selection = item && typeof item === 'object' ? item.selection : undefined;
    const values = [selection?.source, selection?.component]
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim().toLowerCase());

    for (const entry of RESTRICTED_SITES) {
      const site = entry.site.toLowerCase();
      const alias = entry.tier.toLowerCase();
      if (values.some((value) => value === alias || value.includes(site))) {
        violations.push({
          code: 'inspiration-source-as-candidate',
          path: `/regions/${index}/selection`,
          message: `Selection references ${entry.site} (${entry.tier}); visual-inspiration sources must never become component candidates.`,
        });
        break; // one violation per region, not one per matching tier entry
      }
    }
  });

  return { valid: violations.length === 0, violations };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/lib/inspiration-planner.test.mjs`
Expected: PASS — 12 tests.

- [ ] **Step 5: Checkpoint**

Run: `node --test scripts/lib/inspiration-planner.test.mjs`
Expected: `# pass 12`, `# fail 0`.

---

### Task 4: CLI entry point

**Files:**
- Create: `scripts/inspiration-search.mjs`
- Test: `scripts/inspiration-search.test.mjs`

**Interfaces:**
- Consumes: `parseArgs`, `printJson` from `./lib/cli.mjs`; `readJsonFile` from `./lib/project-inspector.mjs`; `searchPlan`, `normalizeCaptured`, `auditPlan` from `./lib/inspiration-planner.mjs`.
- Produces: an executable CLI with three modes and exit codes `0|1|2`.

- [ ] **Step 1: Write the failing test**

Create `scripts/inspiration-search.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, 'inspiration-search.mjs');

test('--channel components emits a JSON plan', async () => {
  const { stdout } = await run(process.execPath, [cli, '--channel', 'components', '--brief', 'data table', '--json']);
  const plan = JSON.parse(stdout);
  assert.equal(plan.channel, 'components');
  assert.deepEqual(plan.tiers, ['T1']);
  assert.ok(plan.targets.length > 0);
});

test('--normalize writes evidence records to --out', async () => {
  const input = path.join(os.tmpdir(), `cdff-captured-${process.pid}.json`);
  const out = path.join(os.tmpdir(), `cdff-evidence-${process.pid}.json`);
  await fs.writeFile(input, JSON.stringify({ references: [
    { url: 'https://dribbble.com/shots/1', publisher: 'Dribbble', tier: 'T3', claim: 'One dominant task above the fold.', capturedAt: '2026-09-13' },
  ] }));
  try {
    await run(process.execPath, [cli, '--normalize', '--input', input, '--out', out, '--json']);
    const records = JSON.parse(await fs.readFile(out, 'utf8'));
    assert.equal(records.length, 1);
    assert.equal(records[0].type, 'observed-pattern');
  } finally {
    await fs.rm(input, { force: true });
    await fs.rm(out, { force: true });
  }
});

test('--audit-plan exits 1 on a tier violation', async () => {
  const file = path.join(os.tmpdir(), `cdff-audit-${process.pid}.json`);
  await fs.writeFile(file, JSON.stringify({ regions: [{ selection: { source: 'dribbble.com', component: 'hero' } }] }));
  try {
    await run(process.execPath, [cli, '--audit-plan', file, '--json']);
    assert.fail('expected a non-zero exit code');
  } catch (error) {
    assert.equal(error.code, 1);
    const result = JSON.parse(error.stdout);
    assert.equal(result.valid, false);
    assert.equal(result.violations[0].code, 'inspiration-source-as-candidate');
  } finally {
    await fs.rm(file, { force: true });
  }
});

test('missing required options exit 2', async () => {
  await assert.rejects(
    run(process.execPath, [cli, '--channel', 'inspiration']),
    (error) => error.code === 2 && /--brief is required/.test(error.stderr),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/inspiration-search.test.mjs`
Expected: FAIL — the CLI file does not exist, so child processes exit non-zero for every case.

- [ ] **Step 3: Write the minimal implementation**

Create `scripts/inspiration-search.mjs`:

```js
#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { parseArgs, printJson } from './lib/cli.mjs';
import { readJsonFile } from './lib/project-inspector.mjs';
import { searchPlan, normalizeCaptured, auditPlan } from './lib/inspiration-planner.mjs';

const help = `Usage:
  inspiration-search.mjs --channel <inspiration|components> --brief <text> [--intent <plan.json>] [--tiers T1,T2,T3] [--json]
  inspiration-search.mjs --normalize --input <captured.json> [--out <evidence.json>] [--json]
  inspiration-search.mjs --audit-plan <plan.json> [--json] [--help]
`;

try {
  const options = parseArgs(process.argv.slice(2), {
    channel: { type: 'string' },
    brief: { type: 'string' },
    intent: { type: 'string' },
    tiers: { type: 'string' },
    normalize: { type: 'boolean' },
    input: { type: 'string' },
    out: { type: 'string' },
    'audit-plan': { type: 'string' },
    json: { type: 'boolean' },
    help: { type: 'boolean' },
  });

  if (options.help) {
    process.stdout.write(help);
  } else if (options['audit-plan']) {
    const result = auditPlan(await readJsonFile(options['audit-plan']));
    if (options.json) printJson(result);
    else {
      process.stdout.write(`${result.valid ? 'valid' : 'invalid'}: ${result.violations.length} violations\n`);
      for (const item of result.violations) process.stdout.write(`${item.code} ${item.path}: ${item.message}\n`);
    }
    if (!result.valid) process.exitCode = 1;
  } else if (options.normalize) {
    if (!options.input) throw new Error('Option --input is required when --normalize is used.');
    const records = normalizeCaptured(await readJsonFile(options.input));
    if (options.out) await fs.writeFile(options.out, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
    if (options.json) printJson(records);
    else process.stdout.write(`${records.length} evidence records\n`);
  } else {
    if (!options.channel) throw new Error('Option --channel is required.');
    if (!options.brief) throw new Error('Option --brief is required.');
    const intent = options.intent ? await readJsonFile(options.intent) : undefined;
    const plan = searchPlan({ channel: options.channel, brief: options.brief, tiers: options.tiers, intent });
    if (options.json) printJson(plan);
    else process.stdout.write(`${plan.status}: ${plan.queries.length} queries across ${plan.targets.length} targets\n`);
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
```

Note: `parseArgs` rejects unknown options and requires values not to start with `--`, so `--channel inspiration` with no `--brief` reaches the `--brief is required` branch. Confirm by running the last test.

Note: the audit branch prints the per-violation text lines only when `--json` is absent. Printing
them unconditionally would append plain text after the JSON payload and break `--json` parsing,
which the Step 1 test asserts. This mirrors `scripts/validate-component-plan.mjs`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/inspiration-search.test.mjs`
Expected: PASS — 4 tests.

- [ ] **Step 5: Checkpoint**

Run: `node scripts/inspiration-search.mjs --channel inspiration --brief 'operations dashboard' --json`
Expected: a JSON plan with `"tiers": ["T2", "T3"]` and non-empty `queries` and `targets`.

Run: `node scripts/inspiration-search.mjs --help`
Expected: prints the three-line usage block and exits 0.

---

### Task 5: Reference doc and route integration

**Files:**
- Create: `references/inspiration-search.md`
- Modify: `SKILL.md`
- Modify: `references/research-ingestion.md`
- Modify: `references/visual-reference-cards.md`
- Modify: `references/source-adapters.md`
- Modify: `references/component-selection.md`

**Interfaces:**
- Consumes: the CLI produced in Task 4 (paths and flags referenced in prose).
- Produces: normative documentation. No code interface.

- [ ] **Step 1: Create the reference doc**

Create `references/inspiration-search.md`:

````markdown
# Inspiration Search

Search other designs and excellent design work to inspire this page—without copying it and
without weakening evidence discipline. Search expands the evidence you may cite; it never
replaces verification.

## When to use

Run the inspiration channel only when the brief gives no visual direction, or when the user
explicitly asks for inspiration. Run the component channel when a region needs a candidate
the project and foundation do not already provide. Skip both when the direction is already
prescribed by the user, brand, or supplied design truth.

## Two channels, never merged

- **Inspiration channel** produces Style Direction candidates and transferable principles.
  It feeds `designIntent.styleDirections` and `designIntent.evidence`.
- **Component channel** produces component candidates. It feeds `region.selection`.

An inspiration source must never become a `selection` candidate. A registry candidate must
never become a visual-quality authority before its rendered behavior is inspected.

## Three-tier trust model

| Tier | Representative sources | Allowed use | Forbidden |
|---|---|---|---|
| T1 — official / registry | shadcn registry, 21st.dev, MagicUI, Aceternity, OriginUI, HeroUI/Mantine/MUI/Ant Design official docs | Produce component candidates, still verified against official docs or a registry | Asserting existence from memory |
| T2 — real products / official design-system cases | Real product sites and public design-system docs, Figma Community official publications, Mobbin | Serve as design evidence that informs Style Directions | Copying layout, brand, copy, or assets |
| T3 — inspiration aggregators | Dribbble, Behance, Awwwards, Godly, Land-book, Refero, Layers | Distill transferable principles only | Copying visuals; becoming a selection candidate |

## Protocol

Run `plan → search → capture → normalize → synthesize`.

1. **Plan.** Emit a tiered search plan:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/inspiration-search.mjs --channel <inspiration|components> --brief '<text>' [--intent <plan.json>] --json
   ```

   Treat the plan as a starting point, not a fixed script.

2. **Search.** Perform the actual search with the runtime's web tools. Search only the tiers
   the plan selected. A search that was not executed is not evidence.

3. **Capture.** For each reference, record URL, publisher, retrieval time, license note, and
   one narrow claim. Reuse the seven protocol rules in [research ingestion](research-ingestion.md).
   Mark login walls, authorization failures, robots disallows, redirects, and stale captures
   as warnings.

4. **Normalize.** Convert captured references into schema-conformant evidence records:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/inspiration-search.mjs --normalize --input <captured.json> [--out <evidence.json>] --json
   ```

   Append the records to `designIntent.evidence`.

5. **Synthesize.** Distill transferable rules into Style Direction candidates and
   [reference cards](visual-reference-cards.md). Describe relationships, hierarchy, and
   behavior—never transplant a page.

## What search must not do

- Do not copy layout, brand marks, copy, or assets from any tier.
- Do not let a T2 or T3 source enter `region.selection`.
- Do not fabricate a reference when a fetch fails or is blocked; record the failure.
- Do not install components during discovery. The component channel still returns
  `requires-command`, and installation remains a separate authorized action.
- Do not treat a remembered gallery item or an unexecuted search as evidence.

## Audit

Before implementation, check the plan for tier violations:

```bash
node .agents/skills/component-driven-frontend/scripts/inspiration-search.mjs --audit-plan <plan.json> --json
```

A violation means a visual-inspiration source leaked into `region.selection`.

## Verification

- Normalized evidence passes `validate-component-plan.mjs --strict` once embedded in a plan.
- Every external source retains URL, publisher, retrieval time, and license note.
````

- [ ] **Step 2: Integrate into `SKILL.md`**

Insert `1a` after the step-1 block. Find this exact text:

```markdown
   If no repository is available, label the stack and foundation as assumptions and defer exact component names. Read [source adapters](references/source-adapters.md) when choosing where to look.

2. Read [design intent](references/design-intent.md)
```

Replace with:

```markdown
   If no repository is available, label the stack and foundation as assumptions and defer exact component names. Read [source adapters](references/source-adapters.md) when choosing where to look.

   When the brief gives no visual direction, or the user asks for inspiration, run the inspiration channel before step 2 and read [inspiration search](references/inspiration-search.md):

   ```bash
   node .agents/skills/component-driven-frontend/scripts/inspiration-search.mjs --channel inspiration --brief '<brief>' --json
   ```

   Execute the searches it plans with your web tools, then normalize what you actually captured into `designIntent.evidence`. A source that was not retrieved is not evidence, and no source may be copied.

2. Read [design intent](references/design-intent.md)
```

Insert `3a` after the component query block. Find this exact text:

```markdown
   Treat `requires-command` as an unexecuted next action, not evidence of availability.
```

Replace with:

```markdown
   Treat `requires-command` as an unexecuted next action, not evidence of availability. When the candidate space is still open, run the component channel first and read [inspiration search](references/inspiration-search.md) for the tiered source list:

   ```bash
   node .agents/skills/component-driven-frontend/scripts/inspiration-search.mjs --channel components --brief '<brief>' --json
   ```
```

Add the prohibition to the Route boundary. Find this exact text:

```markdown
Use a **lightweight path** only when a bounded edit genuinely requires component-system or design judgment—for example choosing a semantic color token, preserving a component variant, or checking an accessibility state. Inspect only the affected component and tokens, state the narrow intent, implement the edit, and run its relevant check. Enter the full route below only if the task expands into component selection, composition, or page-level visual direction.
```

Replace with the same text plus a new sentence:

```markdown
Use a **lightweight path** only when a bounded edit genuinely requires component-system or design judgment—for example choosing a semantic color token, preserving a component variant, or checking an accessibility state. Inspect only the affected component and tokens, state the narrow intent, implement the edit, and run its relevant check. Enter the full route below only if the task expands into component selection, composition, or page-level visual direction.

Search expands the evidence you may cite; it never replaces verification. An inspiration source must never become a component candidate, and no source may be copied.
```

- [ ] **Step 3: Cross-link the four references**

In `references/research-ingestion.md`, find:

```markdown
Visual reference research is separate from installable component discovery. Do not turn a visual inspiration source into a Candidate, and do not turn a Registry Candidate into a visual-quality authority without inspecting its rendered behavior.
```

Replace with:

```markdown
Visual reference research is separate from installable component discovery. Do not turn a visual inspiration source into a Candidate, and do not turn a Registry Candidate into a visual-quality authority without inspecting its rendered behavior. See [inspiration search](inspiration-search.md) for the tiered source model and the capture/normalize protocol that feeds evidence records.
```

In `references/visual-reference-cards.md`, find:

```markdown
When a card is adapted from a supplied screenshot, Figma file, official documentation, or observed product, preserve that evidence separately using [research-ingestion.md](research-ingestion.md). The card itself remains a reusable principle and must not claim ownership of another product's design.
```

Replace with:

```markdown
When a card is adapted from a supplied screenshot, Figma file, official documentation, or observed product, preserve that evidence separately using [research-ingestion.md](research-ingestion.md). The card itself remains a reusable principle and must not claim ownership of another product's design. A card may be distilled from a tiered inspiration search; read [inspiration-search.md](inspiration-search.md) for which tiers may inform a card and which are forbidden.
```

In `references/source-adapters.md`, find:

```markdown
For every candidate, retain the stable fields documented in [component selection](component-selection.md): source, exact name, description/retrieval context, capabilities, dependencies, Registry dependencies, verified install command or `null`, documentation URL or `null`, discovery-only `relevanceScore`, and warnings. Do not convert `requires-command`, an empty result, or a failed command into a candidate, and do not present discovery relevance as the separate final-fit score.
```

Replace with the same text plus a new sentence before it:

```markdown
Before querying, read [inspiration search](inspiration-search.md) for the current T1 source list and its `--channel components` sweep. For every candidate, retain the stable fields documented in [component selection](component-selection.md): source, exact name, description/retrieval context, capabilities, dependencies, Registry dependencies, verified install command or `null`, documentation URL or `null`, discovery-only `relevanceScore`, and warnings. Do not convert `requires-command`, an empty result, or a failed command into a candidate, and do not present discovery relevance as the separate final-fit score.
```

In `references/component-selection.md`, find:

```markdown
All six Design Intent fields are required, including non-empty `coreTask`. Use a string for `foundation`; use a string or `null` for `enhancer`.
```

Replace with:

```markdown
`selection.source` must be a project, foundation, enhancer, registry, or `custom` source. A T2 or T3 visual-inspiration source is never valid here; run `inspiration-search.mjs --audit-plan <plan.json>` to catch a leak. See [inspiration search](inspiration-search.md).

All six Design Intent fields are required, including non-empty `coreTask`. Use a string for `foundation`; use a string or `null` for `enhancer`.
```

- [ ] **Step 4: Verify every new file is reachable**

Run: `grep -c "inspiration-search.md" SKILL.md references/research-ingestion.md references/visual-reference-cards.md references/source-adapters.md references/component-selection.md`
Expected: five lines, each with a count of at least `1`.

Run: `grep -c "inspiration-search.mjs" SKILL.md references/inspiration-search.md`
Expected: `SKILL.md` count is at least `3`; `references/inspiration-search.md` count is at least `1`.

- [ ] **Step 5: Checkpoint**

Run: `node --test scripts/lib/inspiration-planner.test.mjs scripts/inspiration-search.test.mjs`
Expected: all tests pass. Documentation edits must not affect behavior.

---

### Task 6: Full verification

**Files:**
- No new files. Verification only.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: a verified, regression-free change set.

- [ ] **Step 1: Run the whole test suite**

Run: `node --test scripts/lib/inspiration-planner.test.mjs scripts/inspiration-search.test.mjs`
Expected: `# pass 16`, `# fail 0` (12 lib tests + 4 CLI tests).

- [ ] **Step 2: Verify no regression in the existing validator**

`examples/` was removed from this workspace as a redundant asset before implementation, so
regression evidence comes from the test suite.

Run: `node --test scripts/lib/inspiration-planner.test.mjs`
Expected: PASS, including `normalized records satisfy the plan validator`, which exercises
`validateComponentPlan` on a real plan.

If an installed copy of the skill is present, spot-check it read-only (do not copy files back):
`node scripts/validate-component-plan.mjs --file /Users/rainyzhou/Desktop/artdesign/.agents/skills/component-driven-frontend/examples/component-plan.example.json --strict`
Expected: `valid: 4 regions, 0 errors, 0 warnings`. Skip this line when the path is absent.

- [ ] **Step 3: Verify the three CLI modes end to end**

Run: `node scripts/inspiration-search.mjs --channel inspiration --brief 'editorial commerce for a bakery' --json`
Expected: `"tiers": ["T2","T3"]`, non-empty `queries` and `targets`, and `constraints` containing `T3 sources must never become selection candidates.`

Run: `node scripts/inspiration-search.mjs --channel components --brief 'data table with filters' --json`
Expected: `"tiers": ["T1"]` and every query has `"purpose": "component-candidate"`.

Run: `node -e "require('node:fs').writeFileSync('/tmp/cdff-clean-plan.json', JSON.stringify({ regions: [{ selection: { source: 'foundation', component: 'card' } }] }))" && node scripts/inspiration-search.mjs --audit-plan /tmp/cdff-clean-plan.json --json`
Expected: `"valid": true` and exit code 0. Confirm with `echo $?`.

- [ ] **Step 4: Verify the fail-fast paths**

Run: `node scripts/inspiration-search.mjs --channel nonsense --brief 'x'`
Expected: stderr `Unknown channel: nonsense...`, exit code 2 (`echo $?`).

Run: `node scripts/inspiration-search.mjs --channel inspiration --brief 'x' --tiers T9`
Expected: stderr `Unknown tier: T9`, exit code 2.

- [ ] **Step 5: Manual end-to-end on a real brief**

Pick a real product brief. Confirm the agent: (1) runs `1a` and actually retrieves at least
one T2/T3 source, (2) does not fabricate a reference when a fetch is blocked, (3) normalizes
captured references into `designIntent.evidence`, (4) derives Style Direction candidates
rather than copying a source, and (5) passes `validate-component-plan.mjs --strict`.
Record anything the reference doc failed to make unambiguous.

---

## Self-Review

**Spec coverage:**

- Two separate channels → Task 1 (`CHANNEL_TIERS`, `CHANNEL_PURPOSE`) + Task 5 doc section.
- Three-tier trust model → Task 1 (`TIER_SITES`) + Task 5 table + Task 3 audit.
- Full-autonomy search with offline scripts → Task 4 (no network code) + Task 5 protocol step 2.
- Reuse existing anchors, no schema/validator change → Task 2 validator-conformance test; Global Constraints.
- Reference doc + offline script → Tasks 4 and 5.
- Guardrails: no copy, no T2/T3 in selection, no auto-install, no fabrication, license retention → Task 2 (`notes`, `constraints`), Task 3 (audit), Task 5 doc.
- Verification: deterministic output, normalize passes validator, no regression, manual e2e → Tasks 1–6.
- Orphan-asset rule → Task 5 Step 4 link check.

**Placeholder scan:** none. Every code step contains complete code; every command has an expected result.

**Type consistency:** `searchPlan`, `normalizeCaptured`, `auditPlan`, `TIER_SITES`, `tokenizeBrief` are defined in Task 1/2/3 and consumed with the same names and shapes in Task 4. Tier literals are `'T1'|'T2'|'T3'` throughout. Exit codes `0|1|2` are consistent between the CLI code and its tests.
