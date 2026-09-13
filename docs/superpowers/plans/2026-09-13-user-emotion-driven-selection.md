# User-Described Emotion Drives Selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user describe the feeling they want, and let the agent plan Style Direction and component selection from it — as a hard constraint when the user stated it, a soft influence when the agent inferred it.

**Architecture:** Provenance lives on `designIntent.emotionalIntent` (`source` + `userPhrase`). The validator enforces provenance and labelling; the planner gains a `--emotion` input, CJK tokenization, and returns `emotion: { source, text, binding }`. The workflow docs define the elicitation flow and the hard/soft consequences.

**Tech Stack:** Node.js (ESM, `node:test`, `node:assert/strict`), JSON Schema draft 2020-12, Markdown skill docs. No runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-13-user-emotion-driven-selection-design.md`

## Global Constraints

- Run tests with `node --test` from the repository root. Never pass a directory (`node --test scripts/` fails on Node 26); discovery from the root is the supported invocation.
- `scripts/validate-component-plan.mjs --strict` exits 1 when there is **any** warning. Every new warning must not fire on an existing valid plan.
- Existing plans must stay valid: `emotionalIntent.required` is unchanged, and an absent `source` means `inferred`.
- Exact identifiers, copied verbatim from the spec:
  - `emotionalIntent.source` enum: `["user-provided", "inferred"]`
  - error code `invalid-emotional-source`; warning code `emotional-user-phrase-missing`
  - `CJK_FILLER_CHARS = 的了和与及或我你他她它们想要这那`
  - `CJK_STOPWORDS = 感觉, 页面, 风格, 设计, 一个, 一种`
  - tier suffixes — T1 `component library` / `组件库`, T2 `real product ui` / `真实产品界面`, T3 `design inspiration` / `设计灵感`
  - `MAX_QUERY_TOKENS = 3`, `MAX_QUERIES = 6` (unchanged)
- Emotion seed tokens are added to the **inspiration channel only**. The components channel still returns the `emotion` metadata and the binding constraint.
- With no feeling, English token generation must stay byte-identical to today.
- **The working tree currently has three unrelated staged files** (`references/inspiration-search.md`, `scripts/lib/inspiration-planner.mjs`, `scripts/lib/inspiration-planner.test.mjs`) that are reverts of commit `8d7b3ff`. Never run `git add -A`, `git add .`, or `git commit -a`. Every commit in this plan uses explicit paths plus `--only`, and those three files must remain staged and uncommitted.
- Code, comments, and docs are written in English to match the repository.

---

### Task 1: Emotional-intent provenance contract

**Files:**
- Modify: `schemas/component-plan.schema.json` (`$defs.emotionalIntent.properties`)
- Modify: `scripts/lib/plan-validator.mjs` (`validateEmotionalIntent`, around lines 225–250)
- Create: `scripts/lib/plan-validator.test.mjs`

**Interfaces:**
- Consumes: `validateComponentPlan(plan)` from `scripts/lib/plan-validator.mjs` — unchanged signature, returns `{ valid, errors, warnings, summary }`.
- Produces: `emotionalIntent.source` (`"user-provided" | "inferred"`), `emotionalIntent.userPhrase` (string). Error code `invalid-emotional-source`, warning code `emotional-user-phrase-missing`.

- [ ] **Step 1: Write the failing test**

Create `scripts/lib/plan-validator.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateComponentPlan } from './plan-validator.mjs';

const validEmotion = {
  source: 'inferred',
  goal: 'warm curiosity strong enough to place a first order',
  rationale: 'A first-time visitor needs to believe the shop is real.',
  carriers: { visual: 'One real craft photograph' },
  avoid: ['Template gradients'],
  qaQuestions: ['Does the first viewport establish one focal point?'],
};

function basePlan(emotionalIntent) {
  return {
    version: 1,
    designIntent: {
      product: 'Bakery homepage',
      audience: 'First-time visitors',
      coreTask: 'Decide whether to order',
      visualDirection: 'Warm editorial',
      density: 'comfortable',
      principles: ['Let product imagery lead'],
      emotionalIntent,
    },
    foundation: 'shadcn',
    enhancer: null,
    dependencies: [],
    regions: [
      {
        id: 'hero',
        need: 'Understand the difference',
        capabilities: ['marketing'],
        selection: { source: 'foundation', component: 'card' },
        reason: 'Reuse the foundation card',
        states: ['default'],
        responsive: 'Single column on mobile',
        accessibility: { semantics: 'labelled region' },
      },
    ],
  };
}

test('a valid inferred feeling has no errors or warnings', () => {
  const result = validateComponentPlan(basePlan(validEmotion));
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.warnings.length, 0, JSON.stringify(result.warnings));
});

test('an unknown emotional source is an error', () => {
  const result = validateComponentPlan(basePlan({ ...validEmotion, source: 'guessed' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === 'invalid-emotional-source'));
});

test('a user-stated feeling without the user phrase warns', () => {
  const result = validateComponentPlan(basePlan({ ...validEmotion, source: 'user-provided' }));
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((item) => item.code === 'emotional-user-phrase-missing'));
});

test('a user-stated feeling with the user phrase is clean', () => {
  const result = validateComponentPlan(basePlan({
    ...validEmotion,
    source: 'user-provided',
    userPhrase: '想要温暖治愈的感觉',
  }));
  assert.equal(result.valid, true);
  assert.equal(result.warnings.length, 0, JSON.stringify(result.warnings));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/lib/plan-validator.test.mjs`
Expected: FAIL — three tests fail. `invalid-emotional-source` and `emotional-user-phrase-missing` are not produced yet; the first test passes already (it only asserts existing behaviour).

- [ ] **Step 3: Write the minimal implementation**

In `scripts/lib/plan-validator.mjs`, add the source set next to the other emotional constants (after `const emotionalRoles = ...`):

```js
const emotionalSources = new Set(['user-provided', 'inferred']);
```

In `validateEmotionalIntent`, insert this block after the `if (!isRecord(intent)) { ... return; }` guard and before the `if (!isNonEmptyString(intent.goal))` check:

```js
  if (intent.source !== undefined && !emotionalSources.has(intent.source)) {
    errors.push(issue(
      'invalid-emotional-source',
      '/designIntent/emotionalIntent/source',
      `emotionalIntent.source must be one of: ${[...emotionalSources].join(', ')}.`,
    ));
  }

  if (intent.source === 'user-provided' && !isNonEmptyString(intent.userPhrase)) {
    warnings.push(issue(
      'emotional-user-phrase-missing',
      '/designIntent/emotionalIntent/userPhrase',
      'A user-stated feeling should keep the user\'s own words in emotionalIntent.userPhrase.',
    ));
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/lib/plan-validator.test.mjs`
Expected: PASS — 4 tests.

- [ ] **Step 5: Update the schema contract**

In `schemas/component-plan.schema.json`, inside `$defs.emotionalIntent.properties`, add these two properties directly after the `rationale` property:

```json
        "source": { "enum": ["user-provided", "inferred"] },
        "userPhrase": { "type": "string", "minLength": 1 },
```

Leave `required` untouched — both fields are optional so existing plans stay valid.

- [ ] **Step 6: Run the full suite and confirm the existing plan is unaffected**

Run: `node --test`
Expected: PASS — 24 tests (20 existing + 4 new).

Then confirm the canonical example plan still validates:

Run: `node scripts/validate-component-plan.mjs --file .superpowers/sdd/2026-09-13-inspiration-search/e2e-plan.json`
Expected: `valid: ... 0 errors, ... warnings` and no `invalid-emotional-source` or `emotional-user-phrase-missing` line.

- [ ] **Step 7: Commit**

```bash
git add schemas/component-plan.schema.json scripts/lib/plan-validator.mjs scripts/lib/plan-validator.test.mjs
git commit --only schemas/component-plan.schema.json scripts/lib/plan-validator.mjs scripts/lib/plan-validator.test.mjs -m "feat: validate emotional-intent provenance"
```

---

### Task 2: CJK tokenization and language-aware tier suffixes

**Files:**
- Modify: `scripts/lib/inspiration-planner.mjs` (constants near lines 1–14; tokenizers near `tokenizeBrief`; `searchPlan` query loop)
- Modify: `scripts/lib/inspiration-planner.test.mjs`

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `tokenizeCJK(text) => string[]` (exported); `querySuffix(tier, token) => string`; `maxQueryTokens()` stays `MAX_QUERY_TOKENS = 3`. `searchPlan` behaviour for Latin-only briefs is unchanged.

- [ ] **Step 1: Write the failing test**

Append to `scripts/lib/inspiration-planner.test.mjs` (imports already include `searchPlan`):

```js
test('a Chinese brief produces Chinese-suffixed queries', () => {
  const plan = searchPlan({ channel: 'inspiration', brief: '温暖治愈的手工面包首页' });
  assert.equal(plan.queries.length, 6);
  assert.equal(plan.queries[0].text, '温暖 真实产品界面');
  assert.equal(plan.queries[5].text, '治愈 设计灵感');
});

test('an English brief keeps its Latin tier suffixes', () => {
  const plan = searchPlan({ channel: 'inspiration', brief: 'operations dashboard for support teams' });
  assert.deepEqual(plan.queries.map((query) => query.text), [
    'operations real product ui', 'dashboard real product ui', 'support real product ui',
    'operations design inspiration', 'dashboard design inspiration', 'support design inspiration',
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/lib/inspiration-planner.test.mjs`
Expected: FAIL — the Chinese test fails with `plan.queries.length` of `0` and the query-text assertion fails (no queries). The English test passes already.

- [ ] **Step 3: Replace the suffix table**

In `scripts/lib/inspiration-planner.mjs`, replace the `TIER_QUERY_SUFFIX` constant with:

```js
const TIER_QUERY_SUFFIX = {
  T1: { latin: 'component library', cjk: '组件库' },
  T2: { latin: 'real product ui', cjk: '真实产品界面' },
  T3: { latin: 'design inspiration', cjk: '设计灵感' },
};
```

- [ ] **Step 4: Add the CJK tokenizer**

In `scripts/lib/inspiration-planner.mjs`, add after `tokenizeBrief`:

```js
const CJK_FILLER_CHARS = new Set('的了和与及或我你他她它们想要这那');
const CJK_STOPWORDS = new Set(['感觉', '页面', '风格', '设计', '一个', '一种']);
const CJK_RUN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff]+/g;
const CJK_CHAR = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff]/;

function cjkRunTokens(run) {
  let trimmed = run;
  while (trimmed.length && CJK_FILLER_CHARS.has(trimmed[0])) trimmed = trimmed.slice(1);
  while (trimmed.length && CJK_FILLER_CHARS.has(trimmed[trimmed.length - 1])) {
    trimmed = trimmed.slice(0, -1);
  }
  if (trimmed.length < 2) return [];
  if (trimmed.length <= 6) return [trimmed];
  const windows = [];
  for (let index = 0; index + 2 <= trimmed.length; index += 1) {
    const window = trimmed.slice(index, index + 2);
    if ([...window].some((char) => CJK_FILLER_CHARS.has(char))) continue;
    windows.push(window);
  }
  return windows;
}

export function tokenizeCJK(text = '') {
  const tokens = [];
  for (const run of String(text).match(CJK_RUN) ?? []) {
    for (const token of cjkRunTokens(run)) {
      if (CJK_STOPWORDS.has(token) || tokens.includes(token)) continue;
      tokens.push(token);
    }
  }
  return tokens;
}

function dedupeTokens(tokens) {
  const seen = [];
  for (const token of tokens) {
    if (!seen.includes(token)) seen.push(token);
  }
  return seen;
}

function containsCJK(value) {
  return CJK_CHAR.test(value);
}

function querySuffix(tier, token) {
  const suffixes = TIER_QUERY_SUFFIX[tier];
  return containsCJK(token) ? suffixes.cjk : suffixes.latin;
}

function planTokens(text) {
  return dedupeTokens([...tokenizeBrief(text), ...tokenizeCJK(text)]);
}
```

- [ ] **Step 5: Use the new tokenizer and suffix in `searchPlan`**

In `scripts/lib/inspiration-planner.mjs`, replace this line:

```js
  const tokens = tokenizeBrief(`${brief} ${extra}`);
```

with:

```js
  const tokens = planTokens(`${brief} ${extra}`).slice(0, MAX_QUERY_TOKENS);
```

and replace this line inside the query loop:

```js
      queries.push({ text: `${token} ${TIER_QUERY_SUFFIX[tier]}`, tier, purpose });
```

with:

```js
      queries.push({ text: `${token} ${querySuffix(tier, token)}`, tier, purpose });
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test scripts/lib/inspiration-planner.test.mjs`
Expected: PASS — the two new tests plus all existing planner tests, including `planning is deterministic and ignores stopwords`.

- [ ] **Step 7: Run the full suite**

Run: `node --test`
Expected: PASS — 26 tests.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/inspiration-planner.mjs scripts/lib/inspiration-planner.test.mjs
git commit --only scripts/lib/inspiration-planner.mjs scripts/lib/inspiration-planner.test.mjs -m "feat: tokenize CJK briefs in inspiration search plans"
```

---

### Task 3: Stated feeling drives the plan

**Files:**
- Modify: `scripts/lib/inspiration-planner.mjs` (`searchPlan`, `buildConstraints`)
- Modify: `scripts/lib/inspiration-planner.test.mjs`
- Modify: `scripts/inspiration-search.mjs`
- Modify: `scripts/inspiration-search.test.mjs`

**Interfaces:**
- Consumes: `tokenizeCJK`, `dedupeTokens`, `planTokens` from Task 2; `emotionalIntent.source` / `userPhrase` from Task 1.
- Produces: `searchPlan({ channel, brief, tiers, intent, emotion })` returns an added top-level `emotion: { source: 'user-provided' | 'inferred', text: string, binding: 'hard' | 'soft' } | null`. CLI flag `--emotion <text>`.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/lib/inspiration-planner.test.mjs`:

```js
const inferredIntent = (overrides = {}) => ({
  designIntent: {
    emotionalIntent: {
      goal: 'warm curiosity',
      rationale: 'First-time visitors need to trust the shop.',
      carriers: { visual: 'One real photograph' },
      avoid: ['Template gradients'],
      qaQuestions: ['Is there one focal point in the first viewport?'],
      ...overrides,
    },
  },
});

test('a stated feeling leads the plan without dropping the brief subject', () => {
  const plan = searchPlan({ channel: 'inspiration', brief: 'bakery homepage', emotion: '温暖治愈' });
  assert.equal(plan.emotion.source, 'user-provided');
  assert.equal(plan.emotion.binding, 'hard');
  assert.equal(plan.queries[0].text, '温暖治愈 真实产品界面');
  assert.ok(plan.queries.some((query) => query.text.startsWith('bakery ')));
  assert.ok(plan.constraints.some((constraint) => /binding/.test(constraint)));
});

test('the emotion flag outranks the plan emotional intent', () => {
  const plan = searchPlan({
    channel: 'inspiration',
    brief: 'dashboard',
    emotion: '温暖治愈',
    intent: inferredIntent({ source: 'inferred' }),
  });
  assert.equal(plan.emotion.text, '温暖治愈');
  assert.equal(plan.emotion.source, 'user-provided');
  assert.equal(plan.emotion.binding, 'hard');
});

test('an inferred feeling stays soft with no binding constraint', () => {
  const plan = searchPlan({ channel: 'inspiration', brief: 'bakery', intent: inferredIntent() });
  assert.equal(plan.emotion.source, 'inferred');
  assert.equal(plan.emotion.binding, 'soft');
  assert.ok(!plan.constraints.some((constraint) => /binding/.test(constraint)));
});

test('the components channel carries emotion metadata but no emotion tokens', () => {
  const plan = searchPlan({ channel: 'components', brief: 'data table', emotion: '温暖治愈' });
  assert.equal(plan.emotion.binding, 'hard');
  assert.ok(plan.queries.every((query) => !/[\u4e00-\u9fff]/.test(query.text)));
});

test('a plan with no feeling keeps the emotion field null', () => {
  const plan = searchPlan({ channel: 'inspiration', brief: 'bakery' });
  assert.equal(plan.emotion, null);
});
```

Append to `scripts/inspiration-search.test.mjs`:

```js
test('--emotion appears in the JSON plan', async () => {
  const { stdout } = await run(process.execPath, [
    cli, '--channel', 'inspiration', '--brief', 'bakery', '--emotion', '温暖治愈', '--json',
  ]);
  const plan = JSON.parse(stdout);
  assert.equal(plan.emotion.text, '温暖治愈');
  assert.equal(plan.emotion.source, 'user-provided');
  assert.equal(plan.emotion.binding, 'hard');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/lib/inspiration-planner.test.mjs scripts/inspiration-search.test.mjs`
Expected: FAIL — the planner tests fail on `plan.emotion` being `undefined`; the CLI test fails because `--emotion` is an unknown option.

- [ ] **Step 3: Add small helpers to the planner**

In `scripts/lib/inspiration-planner.mjs`, add after `dedupeTokens`:

```js
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
}
```

- [ ] **Step 4: Resolve the feeling and replace the token assembly**

In `scripts/lib/inspiration-planner.mjs` → `searchPlan`, replace:

```js
  const designIntent = intent && typeof intent === 'object' ? intent.designIntent : undefined;
  const extra = [
    designIntent?.visualDirection ?? '',
    ...(Array.isArray(designIntent?.principles) ? designIntent.principles : []),
  ].join(' ');
  const tokens = planTokens(`${brief} ${extra}`).slice(0, MAX_QUERY_TOKENS);
```

with:

```js
  const designIntent = isRecord(intent) ? intent.designIntent : undefined;
  const emotionalIntent = isRecord(designIntent?.emotionalIntent) ? designIntent.emotionalIntent : undefined;
  const extra = [
    designIntent?.visualDirection ?? '',
    ...(Array.isArray(designIntent?.principles) ? designIntent.principles : []),
  ].join(' ');

  const flagEmotion = nonEmptyString(emotion) ? emotion.trim() : '';
  const planEmotion = firstNonEmpty(emotionalIntent?.userPhrase, emotionalIntent?.goal);
  const emotionText = flagEmotion || planEmotion;
  const emotionSource = emotionText
    ? (flagEmotion ? 'user-provided' : (emotionalIntent?.source ?? 'inferred'))
    : null;
  const binding = emotionSource === 'user-provided' ? 'hard' : (emotionSource ? 'soft' : null);

  const emotionTokens = channel === 'inspiration' ? tokenizeCJK(emotionText) : [];
  const subjectTokens = planTokens(`${brief} ${extra}`);
  const tokens = emotionTokens.length
    ? dedupeTokens([
        ...emotionTokens.slice(0, MAX_QUERY_TOKENS - 1),
        ...subjectTokens,
      ]).slice(0, MAX_QUERY_TOKENS)
    : subjectTokens.slice(0, MAX_QUERY_TOKENS);
```

Note: `nonEmptyString` is the existing helper declared later in the file (function declarations hoist), so this works without moving it.

- [ ] **Step 5: Add the binding constraint and the emotion field**

In `scripts/lib/inspiration-planner.mjs`, change the signature and body of `buildConstraints`:

```js
function buildConstraints(tiers, binding) {
```

and immediately before its `return constraints;` line, add:

```js
  if (binding === 'hard') {
    constraints.push('The user-stated feeling is binding: reject Style Directions or candidates that conflict, and record the reason.');
  }
```

Then in `searchPlan`, change the return statement to include the new field:

```js
  return {
    channel,
    status: 'ok',
    tiers: requestedTiers,
    emotion: emotionText ? { source: emotionSource, text: emotionText, binding } : null,
    queries,
    targets,
    constraints: buildConstraints(requestedTiers, binding),
  };
```

- [ ] **Step 6: Run the planner tests to verify they pass**

Run: `node --test scripts/lib/inspiration-planner.test.mjs`
Expected: PASS — all planner tests including the five new ones.

- [ ] **Step 7: Add the CLI flag**

In `scripts/inspiration-search.mjs`:

1. Add to the help text's first usage line, after `--brief <text>`:

```
  inspiration-search.mjs --channel <inspiration|components> --brief <text> [--emotion <text>] [--intent <plan.json>] [--tiers T1,T2,T3] [--json]
```

2. Add `emotion: { type: 'string' },` to the `parseArgs` options, directly after the `brief` entry.

3. Change the plan call to pass it through:

```js
    const plan = searchPlan({ channel: options.channel, brief: options.brief, tiers: options.tiers, intent, emotion: options.emotion });
```

- [ ] **Step 8: Run the CLI tests and the full suite**

Run: `node --test scripts/inspiration-search.test.mjs`
Expected: PASS — 5 tests including `--emotion appears in the JSON plan`.

Run: `node --test`
Expected: PASS — 32 tests.

- [ ] **Step 9: Commit**

```bash
git add scripts/lib/inspiration-planner.mjs scripts/lib/inspiration-planner.test.mjs scripts/inspiration-search.mjs scripts/inspiration-search.test.mjs
git commit --only scripts/lib/inspiration-planner.mjs scripts/lib/inspiration-planner.test.mjs scripts/inspiration-search.mjs scripts/inspiration-search.test.mjs -m "feat: drive inspiration search plans from a stated feeling"
```

---

### Task 4: Wire the workflow and reference docs

**Files:**
- Modify: `SKILL.md`
- Modify: `references/design-intent.md`
- Modify: `references/visual-language.md`
- Modify: `references/visual-qa.md`
- Modify: `references/inspiration-search.md`

**Interfaces:**
- Consumes: `emotionalIntent.source` / `userPhrase` (Task 1), `--emotion` and `emotion.binding` (Task 3).
- Produces: no code. The docs must use the exact field names and the exact `--emotion` flag.

- [ ] **Step 1: Update the SKILL.md inspiration command**

In `SKILL.md` step 1, replace the inspiration-channel command block with:

```bash
   node .agents/skills/component-driven-frontend/scripts/inspiration-search.mjs --channel inspiration --brief '<brief>' [--emotion '<stated feeling>'] --json
```

and immediately after the code fence add:

```
   Pass `--emotion` when the user has already named the feeling they want.
```

- [ ] **Step 2: Replace the SKILL.md emotional-intent paragraph**

In `SKILL.md` step 2, replace the paragraph beginning `Emotional intent is optional.` and its output block with:

```
   Emotional intent is optional, but when it appears the user's own words outrank your inference. If the brief does not state a feeling and the page needs one—brand expression, first-visit conversion, narrative content, or product demonstration—offer 2–4 candidate feelings, each with a one-line rationale and how it would be carried, and let the user pick one or write their own. Then derive it with `Derive emotional intent` in [design intent](references/design-intent.md) and output:

   ```text
   Emotional Intent
   Source: user-stated | inferred
   Goal: ... | Rationale: ...
   Carriers: ... | Avoid: ...
   QA questions: ...
   ```

   A user-stated feeling is explicit user evidence and a hard constraint: record `designIntent.emotionalIntent.source: "user-provided"` and keep the user's words in `userPhrase`, and do not label it `Assumption — user may override`. Reject any Style Direction or component candidate that conflicts, recording the reason in that direction's `tradeoffs` or the region's `rejectedCandidates`. An inferred feeling stays soft: record `source: "inferred"` and label the goal `Assumption — user may override`; it orders and justifies but does not reject.
```

Keep the existing trailing sentence `Emotional intent never authorizes a second foundation, an extra enhancer, or decorative effects that the content hierarchy does not justify.` directly after this paragraph.

- [ ] **Step 3: Update the SKILL.md component-selection step**

In `SKILL.md` step 3, append this sentence after the closing ``` of the `--channel components` code block (the last content of step 3, before the `4. Produce the full JSON contract` step):

```
   When `designIntent.emotionalIntent.source` is `user-provided`, every candidate you reject for conflicting with the stated feeling must appear in the region's `rejectedCandidates` with that reason.
```

- [ ] **Step 4: Update `references/design-intent.md`**

In the `## Derive emotional intent` section, change the derivation chain line to:

```
`user-stated feeling (if any) → product type → audience state → core task → pressure or expectation → desired feeling → carriers`
```

Then insert this subsection immediately before the emotional-intent field table — the table in the `## Derive emotional intent` section whose header row is `| Field | Decide |` and whose first body row is `| `goal` | The experience the page should produce for that audience in that state |`. Do not insert it before the six-field table under `## Write six fields`:

```markdown
## Source the feeling

Record where the feeling comes from before deriving it.

| `source` | When | Binding | Label |
|---|---|---|---|
| `user-provided` | The user named the feeling, or picked one of the candidates you offered | Hard — conflicting Style Directions and candidates are rejected with a recorded reason | none |
| `inferred` (or absent) | You derived it from product, audience, and core task | Soft — it orders and justifies, but does not reject | `Assumption — user may override` |

When the brief names no feeling but the page needs one, offer 2–4 candidate feelings, each with a one-line rationale and the carriers that would express it, then let the user pick one or write their own. Never offer more than four, and never silently replace a user-stated feeling with your own.

For `user-provided`, copy the user's words verbatim into `userPhrase`; the `goal` still states the experience, not the adjective. `高级` must become an experience such as `confidence that the tool will not waste my time`.
```

- [ ] **Step 5: Update `references/visual-language.md`**

In `## Carry the emotional goal`, append this paragraph after the `emotionalRole` table's closing paragraph:

```markdown
When `emotionalIntent.source` is `user-provided`, the selected direction's `emotionalEffect` must state how its shape, material, and interaction satisfy the user's own words, and every candidate you reject for conflicting with them must carry that reason in its `tradeoffs`. Do not silently drop a conflicting candidate.
```

- [ ] **Step 6: Update `references/visual-qa.md`**

In `## Emotional review`, after the sentence that begins `When the plan declares `emotionalIntent.qaQuestions``, add:

```markdown
When `emotionalIntent.source` is `user-provided`, those questions are mandatory: answer each against the user's stated feeling rather than a feeling you inferred. A failed answer is still a design finding, not an automatic build failure.
```

- [ ] **Step 7: Update `references/inspiration-search.md`**

Insert this section after `## Two channels, never merged` and before `## Three-tier trust model`:

```markdown
## Stated feeling

When the user has named a feeling, pass it to the plan so the seed queries lead with it:

```bash
node .agents/skills/component-driven-frontend/scripts/inspiration-search.mjs --channel inspiration --brief '<brief>' --emotion '<user words>' --json
```

`--emotion` outranks `emotionalIntent.userPhrase` and `emotionalIntent.goal` from `--intent`. Emotion seeds are added to the inspiration channel only; the components channel keeps the metadata and the binding constraint but no emotion tokens. Chinese input is tokenized into 2–6 character terms, with longer runs split into 2-character windows, and a CJK token uses the Chinese tier suffix (`组件库`, `真实产品界面`, `设计灵感`). When the resolved feeling is `user-provided`, `binding` is `hard` and the plan adds a constraint requiring conflicting Style Directions or candidates to be rejected with a recorded reason. Seed queries remain starting points to be rewritten, not the search to run.
```

- [ ] **Step 8: Verify the docs reference real behaviour**

Run: `grep -rn "emotionalIntent.source\|--emotion\|userPhrase" SKILL.md references/`

Expected: the new text appears in all five files; no reference to a field or flag that Tasks 1–3 did not implement.

Run: `node scripts/inspiration-search.mjs --channel inspiration --brief '温暖治愈的手工面包首页' --emotion '温暖治愈' --json`

Expected: JSON whose `emotion.binding` is `hard`, whose first query ends with `真实产品界面`, and whose `constraints` include the binding line.

- [ ] **Step 9: Commit**

```bash
git add SKILL.md references/design-intent.md references/visual-language.md references/visual-qa.md references/inspiration-search.md
git commit --only SKILL.md references/design-intent.md references/visual-language.md references/visual-qa.md references/inspiration-search.md -m "docs: wire user-stated emotion into the skill workflow"
```

---

### Task 5: End-to-end verification against the spec

**Files:**
- No source changes. This task produces evidence only.

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: a pass/fail report for the spec's Verification section.

- [ ] **Step 1: Run the full suite**

Run: `node --test`
Expected: PASS — 32 tests, 0 failures.

- [ ] **Step 2: Prove the Chinese end-to-end plan**

Run: `node scripts/inspiration-search.mjs --channel inspiration --brief '温暖治愈的手工面包首页' --emotion '温暖治愈' --json`

Expected: `emotion` is `{ source: "user-provided", text: "温暖治愈", binding: "hard" }`; `queries[0].text` is `温暖治愈 真实产品界面`; at least one query contains `手工` from the brief; `constraints` contains the binding line.

- [ ] **Step 3: Prove the strict validator accepts a user-stated plan**

Write `/tmp/cdff-user-emotion-plan.json` with:

```json
{
  "version": 1,
  "designIntent": {
    "product": "Bakery homepage",
    "audience": "First-time visitors",
    "coreTask": "Decide whether to order",
    "visualDirection": "Warm editorial",
    "density": "comfortable",
    "principles": ["Let product imagery lead"],
    "emotionalIntent": {
      "source": "user-provided",
      "userPhrase": "想要温暖治愈的感觉",
      "goal": "warm curiosity strong enough to place a first order",
      "rationale": "A first-time visitor needs to believe the shop is real.",
      "carriers": { "visual": "One real craft photograph" },
      "avoid": ["Template gradients"],
      "qaQuestions": ["Does the first viewport establish one focal point?"]
    }
  },
  "foundation": "shadcn",
  "enhancer": null,
  "dependencies": [],
  "regions": [
    {
      "id": "hero",
      "need": "Understand the difference",
      "capabilities": ["marketing"],
      "selection": { "source": "foundation", "component": "card" },
      "reason": "Reuse the foundation card",
      "states": ["default"],
      "responsive": "Single column on mobile",
      "accessibility": { "semantics": "labelled region" }
    }
  ]
}
```

Run: `node scripts/validate-component-plan.mjs --file /tmp/cdff-user-emotion-plan.json --strict`
Expected: exit 0 — `valid: 1 regions, 0 errors, 0 warnings`.

- [ ] **Step 4: Prove the strict validator rejects a bad source**

Change `"source": "user-provided"` to `"source": "guessed"` in `/tmp/cdff-user-emotion-plan.json`, then:

Run: `node scripts/validate-component-plan.mjs --file /tmp/cdff-user-emotion-plan.json --strict`
Expected: exit 1 and an `invalid-emotional-source` line.

Restore the file or delete it afterwards.

- [ ] **Step 5: Report**

Report the exact commands and observed output for Steps 1–4. If any expectation does not hold, report the mismatch rather than claiming completion. Do not commit — this task changes no tracked files.

---

## Self-Review

**Spec coverage**

- Contract `source` + `userPhrase` → Task 1 Step 5. ✓
- Error `invalid-emotional-source`, warning `emotional-user-phrase-missing`, no new warning for `inferred` → Task 1 Step 3, covered by the "valid inferred feeling has no warnings" test. ✓
- Planner signature, resolution order, `binding` derivation → Task 3 Step 4. ✓
- CJK tokenization and language-aware suffixes → Task 2 Steps 3–5. ✓
- Emotion tokens inspiration-only, emotion-first with a brief slot → Task 3 Step 4, tested by the components test and the "without dropping the brief subject" test. ✓
- `emotion` output and the hard-binding constraint line → Task 3 Step 5. ✓
- CLI `--emotion` → Task 3 Step 7. ✓
- SKILL.md elicitation, source/binding, `Source:` output line, step-3 rejection recording → Task 4 Steps 1–3. ✓
- design-intent / visual-language / visual-qa / inspiration-search doc updates → Task 4 Steps 4–7. ✓
- Tests for planner, validator, CLI → Tasks 1–3. ✓
- Verification section commands → Task 5. ✓

**Placeholder scan:** no TBD/TODO; every code step carries the full code, and every doc step carries the exact Markdown to insert.

**Type consistency:** `searchPlan({ channel, brief, tiers, intent, emotion })`, `emotion: { source, text, binding }`, `tokenizeCJK`, `dedupeTokens`, `planTokens`, `querySuffix`, `buildConstraints(tiers, binding)`, `emotionalSources`, `invalid-emotional-source`, `emotional-user-phrase-missing` are used identically across tasks. Task 2's `planTokens` is consumed by Task 3 unchanged.

**Known limit, carried from the spec:** the hard constraint's semantic conflict is not machine-checkable; the validator enforces provenance and labelling only, while conflict rejection is a workflow rule recorded in `tradeoffs` / `rejectedCandidates`. No task pretends otherwise.
