# User-Described Emotion Drives Selection — Design

Date: 2026-09-13
Status: approved (pending written-spec review)

## Background

`component-driven-frontend` already models emotional intent end to end: `designIntent.emotionalIntent`
(schema + validator), carried by the shape/material/interaction systems in
`references/visual-language.md`, and reviewed through `references/visual-qa.md`.

Two gaps remain:

1. The feeling can only be **inferred by the agent** from the brief. The user cannot state it, and
   the contract has no provenance, so a user-stated feeling is indistinguishable from an agent
   guess and is labelled `Assumption — user may override`.
2. The planning tooling ignores feeling. `searchPlan` reads only `designIntent.visualDirection` and
   `designIntent.principles`. Its tokenizer keeps only `[a-z0-9]`, so a Chinese brief yields zero
   queries (verified: `温暖治愈的手工面包首页` → `[]`).

## Goal

Let the user describe the feeling they want, and let that description drive planning and selection:

- When the user states the feeling, it is explicit user evidence (highest authority) and a **hard
  constraint** on Style Direction and component selection.
- When the agent infers the feeling, it stays a **soft** influence and is labelled as an assumption.
- The described feeling reaches the planner, which plans search seeds around it, including for
  Chinese input.

## Non-goals

- No machine-checkable semantic conflict detection; see [Limits](#limits).
- No new artifact type or CLI command; the feeling rides on `designIntent.emotionalIntent`.
- No change to the one-foundation / at-most-one-enhancer invariants, and no authorization for
  decorative effects.
- No emotion tokens in the components (T1) channel's queries.
- No touching the unrelated staged reverts already present in the working tree.

## Confirmed decisions

1. Scope: all three layers — workflow/docs, planner/CLI, schema/validator.
2. Binding is tiered: `user-provided` → hard; `inferred` → soft.
3. Elicitation: when a feeling is needed and absent, offer 2–4 candidate feelings; the user may pick
   one or write their own.
4. Planner input: accept both `--emotion '<user words>'` and `emotionalIntent` from `--intent`; the
   flag wins.
5. Provenance lives on `emotionalIntent` (`source` + `userPhrase`), not a parallel `userEmotion`
   object.

## Design

### 1. Contract

`schemas/component-plan.schema.json` → `$defs.emotionalIntent.properties` gains:

```json
"source": { "enum": ["user-provided", "inferred"] },
"userPhrase": { "type": "string", "minLength": 1 }
```

Both are optional and `required` is unchanged, so existing plans (including the bakery example and
`.superpowers/sdd/2026-09-13-inspiration-search/e2e-plan.json`) stay valid. An absent `source` means
`inferred`.

`userPhrase` preserves the user's own words verbatim; `goal` remains the experience statement, not
the adjective.

### 2. Validation

`scripts/lib/plan-validator.mjs` → `validateEmotionalIntent`:

- Add `emotionalSources = new Set(['user-provided', 'inferred'])`.
- `source` present but not in the set → **error** `invalid-emotional-source` at
  `/designIntent/emotionalIntent/source`.
- `source === 'user-provided'` with a missing or empty `userPhrase` → **warning**
  `emotional-user-phrase-missing` at `/designIntent/emotionalIntent/userPhrase`.
- `inferred` and absent `source` → no new warning.
- The existing `generic-emotional-goal` check applies to both sources: a user phrase such as `高级`
  must still be translated into an experience goal.

Deliberately **not** added: a warning for an unlabelled inferred goal. The canonical bakery example
carries no `Assumption` label, and `--strict` treats warnings as failures, so this would break
existing valid plans. Labelling stays a workflow rule.

### 3. Planner and CLI

`scripts/lib/inspiration-planner.mjs`:

- Signature: `searchPlan({ channel, brief = '', tiers, intent, emotion } = {})`.
- Feeling resolution, first non-empty wins:
  1. `emotion` (the `--emotion` flag)
  2. `intent.designIntent.emotionalIntent.userPhrase`
  3. `intent.designIntent.emotionalIntent.goal`
- Provenance: a non-empty `--emotion` is `user-provided`; otherwise the plan's
  `source ?? 'inferred'`. `binding = source === 'user-provided' ? 'hard' : 'soft'`.
- Tokenization: Latin tokens keep today's rules (`[a-z0-9]`, length ≥ 3, stopwords, dedup). CJK runs
  are extracted separately and processed with a filler-character set
  `CJK_FILLER_CHARS = 的了和与及或我你他她它们想要这那` and a token stoplist
  `CJK_STOPWORDS = 感觉, 页面, 风格, 设计, 一个, 一种`:
  - trim filler characters from both ends of each run;
  - remaining length 2–6 → one token;
  - remaining length > 6 → 2-character sliding windows, dropping any window whose characters include
    a filler character;
  - drop tokens in `CJK_STOPWORDS`, then dedup preserving first-seen order.
  The window filter drops windows built around `的`, so `温暖治愈的手工面包` yields `温暖`, `暖治`,
  `治愈`, `手工`, `工面`, `面包`, and a run that reduces to `感觉` disappears via the stoplist. Window
  noise is acceptable because queries are documented seeds to be rewritten, and the global token cap
  bounds it.
- Tier suffixes become language-aware: T1 `component library` / `组件库`, T2 `real product ui` /
  `真实产品界面`, T3 `design inspiration` / `设计灵感`; a CJK token selects the Chinese suffix.
- Emotion tokens are added to the **inspiration channel only**; the components channel gets emotion
  metadata and the binding constraint but no emotion seed tokens.
- Ordering: emotion tokens lead, but at least one slot is reserved for the brief — emotion takes
  `min(emotionTokens.length, MAX_QUERY_TOKENS - 1)` slots and the brief fills the rest. With no
  feeling, token generation is byte-identical to today.
- New output: `emotion: { source, text, binding } | null`.
- When `binding === 'hard'`, `constraints` gains a line: the user-stated feeling is binding, and
  conflicting Style Directions or candidates must be rejected with the reason recorded.

`scripts/inspiration-search.mjs`: add `emotion: { type: 'string' }`, pass it through, and update the
help text.

### 4. Workflow and docs

- `SKILL.md`
  - Step 1: the inspiration command accepts `[--emotion '<user-stated feeling>']`.
  - Step 2: when the brief does not state a feeling and the page needs one, offer 2–4 candidate
    feelings, each with a one-line rationale and how it would be carried; the user may pick one or
    write their own.
  - Step 2: a user-stated feeling is explicit user evidence → hard constraint, record
    `source: "user-provided"` and `userPhrase`, and do **not** label it `Assumption`.
  - Step 2: an inferred feeling → soft constraint, `source: "inferred"`, label
    `Assumption — user may override`.
  - Step 2 output block gains `Source: user-stated | inferred (Assumption — user may override)`.
  - Step 3: a hard-constraint rejection must land in `rejectedCandidates` / `reason`.
- `references/design-intent.md`: `Derive emotional intent` gains a source-and-binding subsection —
  user-stated is authority #1; the chain becomes
  `product type → audience state → core task → pressure or expectation → user-stated feeling → carriers`;
  a raw adjective is translated into an experience goal; hard vs soft consequences and where each
  lands.
- `references/visual-language.md`: when `source` is `user-provided`, the selected direction's
  `emotionalEffect` must state how it satisfies the user's words, and conflicting candidates are
  rejected with reasons rather than silently dropped.
- `references/visual-qa.md`: a user-stated feeling's `qaQuestions` are mandatory review items; a
  failure is still a design finding, not an automatic build failure.
- `references/inspiration-search.md`: document `--emotion`, its precedence, CJK behaviour,
  emotion-first ordering, and the hard-binding constraint line.

### 5. Tests

- `scripts/lib/inspiration-planner.test.mjs`: Chinese brief emits Chinese-suffixed queries;
  `--emotion` beats the plan's `emotionalIntent`; `user-provided` → `binding: 'hard'` and the
  constraint line; `inferred` → `soft`; components channel has metadata but no emotion tokens;
  no-emotion plans unchanged.
- New `scripts/lib/plan-validator.test.mjs`: invalid `source` → error; `user-provided` without
  `userPhrase` → warning; with it → clean.
- `scripts/inspiration-search.test.mjs`: the CLI accepts `--emotion` and reflects it in the JSON
  plan.
- Run `node --test` (current 20 + new) and one end-to-end `--emotion` run with Chinese input.

## Behaviour matrix

| `source` | Binding | Provenance fields | Label | Selection effect |
|---|---|---|---|---|
| `user-provided` | hard | `userPhrase` required | none | Conflicting directions/candidates rejected, reason recorded |
| `inferred` (or absent) | soft | — | `Assumption — user may override` | Orders and justifies; does not reject |

## Limits

Semantic conflict between a stated feeling and a style direction or component candidate is **not
machine-checkable**. The validator enforces provenance, shape, and labelling only; the hard
constraint is enforced by the workflow rules and made traceable through `rejectedCandidates` and
`styleDirections[].tradeoffs`. This half is a documented convention, not a hard gate, and this spec
says so rather than implying otherwise.

## Files changed

- `schemas/component-plan.schema.json`
- `scripts/lib/plan-validator.mjs`
- `scripts/lib/plan-validator.test.mjs` (new)
- `scripts/lib/inspiration-planner.mjs`
- `scripts/lib/inspiration-planner.test.mjs`
- `scripts/inspiration-search.mjs`
- `scripts/inspiration-search.test.mjs`
- `SKILL.md`
- `references/design-intent.md`
- `references/visual-language.md`
- `references/visual-qa.md`
- `references/inspiration-search.md`

## Verification

- `node --test` passes.
- `node scripts/inspiration-search.mjs --channel inspiration --brief '<zh brief>' --emotion '<zh feeling>' --json`
  returns CJK queries led by the feeling and `emotion.binding: 'hard'`.
- `node scripts/validate-component-plan.mjs --file <plan> --strict` fails on an invalid `source`,
  warns on a missing `userPhrase`, and passes once fixed.
