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
      principles: [
        'Product imagery leads the first viewport',
        'One primary action per view',
        'States share the same geometry',
      ],
      primaryAction: 'Start an order',
      successCriteria: [
        'A first-time visitor can name one reason to order within five seconds',
        'The order action stays reachable at 320px and 200% zoom',
      ],
      tokens: {
        typography: { display: '32/1.15', body: '16/1.6' },
        spacingRhythm: '8px base with 1.5 steps',
        radiusTiers: ['control', 'panel'],
        elevationTiers: ['raised', 'overlay'],
      },
      contrastPairs: [
        { foreground: '#0a0a0a', background: '#ffffff' },
      ],
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

test('a user phrase without a source warns instead of demoting to soft', () => {
  const { source, ...withoutSource } = validEmotion;
  const result = validateComponentPlan(basePlan({
    ...withoutSource,
    userPhrase: '想要温暖治愈的感觉',
  }));
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some((item) => item.code === 'emotional-user-phrase-unmarked'), JSON.stringify(result.warnings));
});

test('a user phrase marked inferred warns instead of demoting to soft', () => {
  const result = validateComponentPlan(basePlan({
    ...validEmotion,
    source: 'inferred',
    userPhrase: '想要温暖治愈的感觉',
  }));
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some((item) => item.code === 'emotional-user-phrase-unmarked'), JSON.stringify(result.warnings));
});

const projectFixture = (overrides = {}) => ({
  designSystems: ['shadcn'],
  activeFoundation: 'shadcn',
  hasPackageJson: true,
  dependencies: ['react', 'recharts'],
  shadcn: { configPath: 'components.json', registries: ['@magicui'] },
  components: [{ name: 'data-table', path: 'src/components/ui/data-table.tsx' }],
  ...overrides,
});

const planWith = (overrides = {}) => ({ ...basePlan(validEmotion), ...overrides });

test('a foundation the project does not use is an error', () => {
  const result = validateComponentPlan(planWith(), {
    project: projectFixture({ designSystems: ['mantine'], activeFoundation: 'mantine' }),
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === 'foundation-not-in-project'));
});

test('a foundation the project does use is accepted', () => {
  const result = validateComponentPlan(planWith(), { project: projectFixture() });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('a project with no detectable foundation warns instead of failing', () => {
  const result = validateComponentPlan(planWith(), {
    project: projectFixture({ designSystems: [], activeFoundation: null }),
  });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some((item) => item.code === 'foundation-unverified'));
});

test('a declared enhancer without its configured registry warns', () => {
  const result = validateComponentPlan(planWith({ enhancer: 'magicui' }), {
    project: projectFixture({ shadcn: { configPath: 'components.json', registries: [] } }),
  });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some((item) => item.code === 'enhancer-registry-not-configured'));
});

test('an installed enhancer registry keeps the plan clean', () => {
  const result = validateComponentPlan(planWith({ enhancer: 'magicui' }), { project: projectFixture() });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.warnings.length, 0, JSON.stringify(result.warnings));
});

test('an installed dependency must exist in the project', () => {
  const missing = validateComponentPlan(
    planWith({ dependencies: [{ name: 'chart-lib', reason: 'charts', new: false }] }),
    { project: projectFixture() },
  );
  assert.equal(missing.valid, false);
  assert.ok(missing.errors.some((item) => item.code === 'dependency-not-installed'));

  const present = validateComponentPlan(
    planWith({ dependencies: [{ name: 'recharts', reason: 'charts', new: false }] }),
    { project: projectFixture() },
  );
  assert.equal(present.valid, true, JSON.stringify(present.errors));
});

test('an already installed dependency marked as new warns', () => {
  const result = validateComponentPlan(
    planWith({ dependencies: [{ name: 'recharts', reason: 'charts', new: true }] }),
    { project: projectFixture() },
  );
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some((item) => item.code === 'dependency-marked-new-but-installed'));
});

test('dependencies are not guessed when the project has no package.json', () => {
  const result = validateComponentPlan(
    planWith({ dependencies: [{ name: 'chart-lib', reason: 'charts', new: false }] }),
    { project: projectFixture({ hasPackageJson: false, dependencies: [] }) },
  );
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.warnings.some((item) => item.code === 'dependency-unverified'));
});

test('foundation must be a string, not a single-element array', () => {
  const result = validateComponentPlan(planWith({ foundation: ['shadcn'] }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === 'invalid-foundation'));
});

test('visualLanguage requires shape, material, and interaction', () => {
  const plan = planWith();
  plan.designIntent = {
    ...plan.designIntent,
    styleDirections: [
      {
        id: 'a',
        name: 'A',
        description: 'd',
        profile: { shape: { radius: '1' }, material: { surface: '1' }, interaction: { hover: '1' } },
      },
      {
        id: 'b',
        name: 'B',
        description: 'd',
        profile: { shape: { radius: '2' }, material: { surface: '2' }, interaction: { hover: '2' } },
      },
    ],
    selectedStyleDirection: 'a',
    visualLanguage: { sourceDirectionId: 'a' },
  };
  const result = validateComponentPlan(plan);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === 'visual-language-profile-required'));
});

const regionWith = (overrides = {}) => ({ ...basePlan(validEmotion).regions[0], ...overrides });
const craftPlan = (overrides = {}) => planWith(overrides);
const codes = (result) => [...result.errors, ...result.warnings].map((item) => item.code);

test('two focal regions are an error', () => {
  const result = validateComponentPlan(craftPlan({
    regions: [
      regionWith({ id: 'a', emotionalRole: 'focal' }),
      regionWith({ id: 'b', emotionalRole: 'focal' }),
    ],
  }));
  assert.equal(result.valid, false);
  assert.ok(codes(result).includes('multiple-focal-regions'));
});

test('generic-only visual direction warns', () => {
  const plan = craftPlan();
  plan.designIntent = { ...plan.designIntent, visualDirection: 'premium modern minimal' };
  const result = validateComponentPlan(plan);
  assert.ok(codes(result).includes('generic-visual-direction'));
});

test('a responsive note without a transformation warns', () => {
  const result = validateComponentPlan(craftPlan({
    regions: [regionWith({ responsive: 'Responsive.' })],
  }));
  assert.ok(codes(result).includes('vague-responsive'));
});

test('a CJK responsive note passes when it names a transformation', () => {
  const result = validateComponentPlan(craftPlan({
    regions: [regionWith({ responsive: '移动端改为单列堆叠' })],
  }));
  assert.ok(!codes(result).includes('vague-responsive'));
});

test('a data region needs more than a default state and a content model', () => {
  const result = validateComponentPlan(craftPlan({
    regions: [regionWith({ capabilities: ['data'], states: ['default'] })],
  }));
  assert.ok(codes(result).includes('single-default-state'));
  assert.ok(codes(result).includes('content-model-missing'));
});

test('an interactive region must name interaction states', () => {
  const result = validateComponentPlan(craftPlan({
    regions: [regionWith({
      capabilities: ['interactive', 'controls'],
      states: ['default', 'loading', 'empty', 'error', 'success'],
      accessibility: { keyboard: 'tab order', focus: 'visible ring', semantics: 'button role' },
    })],
  }));
  assert.ok(codes(result).includes('interactive-states-incomplete'));

  const fixed = validateComponentPlan(craftPlan({
    regions: [regionWith({
      capabilities: ['interactive', 'controls'],
      states: ['default', 'hover', 'focus', 'pressed', 'disabled'],
      accessibility: { keyboard: 'tab order', focus: 'visible ring', semantics: 'button role' },
    })],
  }));
  assert.ok(!codes(fixed).includes('interactive-states-incomplete'));
});

test('omitting principles beyond the documented range warns', () => {
  const few = craftPlan();
  few.designIntent = { ...few.designIntent, principles: ['One rule'] };
  assert.ok(codes(validateComponentPlan(few)).includes('principles-too-few'));

  const many = craftPlan();
  many.designIntent = {
    ...many.designIntent,
    principles: ['a', 'b', 'c', 'd', 'e', 'f'],
  };
  assert.ok(codes(validateComponentPlan(many)).includes('principles-too-many'));
});

test('success criteria are required and must be strings', () => {
  const missing = craftPlan();
  const { successCriteria, ...withoutCriteria } = missing.designIntent;
  missing.designIntent = withoutCriteria;
  assert.ok(codes(validateComponentPlan(missing)).includes('success-criteria-missing'));

  const invalid = craftPlan();
  invalid.designIntent = { ...invalid.designIntent, successCriteria: 'do better' };
  const result = validateComponentPlan(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === 'invalid-success-criteria'));
});

test('an operable page must name its primary action', () => {
  const plan = craftPlan();
  const { primaryAction, ...withoutAction } = plan.designIntent;
  plan.designIntent = withoutAction;
  assert.ok(codes(validateComponentPlan(plan)).includes('primary-action-missing'));
});

test('token decisions and spacing rhythm are expected', () => {
  const missingTokens = craftPlan();
  const { tokens, ...withoutTokens } = missingTokens.designIntent;
  missingTokens.designIntent = withoutTokens;
  assert.ok(codes(validateComponentPlan(missingTokens)).includes('tokens-missing'));

  const missingRhythm = craftPlan();
  missingRhythm.designIntent = {
    ...missingRhythm.designIntent,
    tokens: { radiusTiers: ['control', 'panel'] },
  };
  assert.ok(codes(validateComponentPlan(missingRhythm)).includes('spacing-rhythm-missing'));
});

test('the selected direction should state its effect boundaries', () => {
  const plan = craftPlan();
  plan.designIntent = {
    ...plan.designIntent,
    styleDirections: [
      {
        id: 'a',
        name: 'A',
        description: 'd',
        profile: { shape: { radius: '2' }, material: { surface: 'opaque' }, interaction: { hover: 'tint' } },
      },
      {
        id: 'b',
        name: 'B',
        description: 'd',
        profile: { shape: { radius: '3' }, material: { surface: 'elevated' }, interaction: { hover: 'lift' } },
      },
    ],
    selectedStyleDirection: 'a',
    visualLanguage: {
      sourceDirectionId: 'a',
      shape: { radius: '2' },
      material: { surface: 'opaque' },
      interaction: { hover: 'tint' },
    },
  };
  assert.ok(codes(validateComponentPlan(plan)).includes('effect-boundaries-missing'));

  plan.designIntent.styleDirections[0].profile.effectBoundaries = ['no glass', 'no gradient'];
  assert.ok(!codes(validateComponentPlan(plan)).includes('effect-boundaries-missing'));
});

const tokenProject = (variables) => projectFixture({ designTokens: { variables } });

test('a declared contrast pair below target blocks the plan', () => {
  const plan = craftPlan();
  plan.designIntent = {
    ...plan.designIntent,
    contrastPairs: [{ foreground: 'muted-foreground', background: 'background' }],
  };
  const result = validateComponentPlan(plan, {
    project: tokenProject([
      { name: '--background', value: '#ffffff' },
      { name: '--muted-foreground', value: '#cccccc' },
    ]),
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === 'contrast-below-target'));
});

test('a pair above target passes, and kind selects the threshold', () => {
  const base = craftPlan();
  const resultFor = (pair) => {
    const plan = craftPlan();
    plan.designIntent = { ...base.designIntent, contrastPairs: [pair] };
    return validateComponentPlan(plan);
  };

  assert.ok(!codes(resultFor({ foreground: '#595959', background: '#ffffff' })).includes('contrast-below-target'));
  // About 3.45:1: passes the 3:1 UI target, fails the 4.5:1 text target.
  assert.ok(!codes(resultFor({ foreground: '#8a8a8a', background: '#ffffff', kind: 'ui' })).includes('contrast-below-target'));
  assert.ok(codes(resultFor({ foreground: '#8a8a8a', background: '#ffffff' })).includes('contrast-below-target'));
});

test('AAA raises the text threshold', () => {
  const aaa = craftPlan();
  aaa.designIntent = {
    ...aaa.designIntent,
    contrastLevel: 'AAA',
    contrastPairs: [{ foreground: '#767676', background: '#ffffff' }],
  };
  assert.ok(codes(validateComponentPlan(aaa)).includes('contrast-below-target'));

  const aa = craftPlan();
  aa.designIntent = { ...aa.designIntent, contrastPairs: [{ foreground: '#767676', background: '#ffffff' }] };
  assert.ok(!codes(validateComponentPlan(aa)).includes('contrast-below-target'));
});

test('token references are verified against project tokens', () => {
  const withReference = (project) => {
    const plan = craftPlan();
    plan.designIntent = {
      ...plan.designIntent,
      contrastPairs: [{ foreground: 'foreground', background: 'background' }],
    };
    return validateComponentPlan(plan, { project });
  };

  const unverified = withReference(projectFixture({ designTokens: { variables: [] } }));
  assert.equal(unverified.valid, true);
  assert.ok(unverified.warnings.some((item) => item.code === 'contrast-unverified'));

  const missing = withReference(tokenProject([{ name: '--foreground', value: '#0a0a0a' }]));
  assert.equal(missing.valid, false);
  assert.ok(missing.errors.some((item) => item.code === 'contrast-token-not-found'));
});

test('a plan with tokens but no contrast pairs warns', () => {
  const plan = craftPlan();
  const { contrastPairs, ...withoutPairs } = plan.designIntent;
  plan.designIntent = withoutPairs;
  assert.ok(codes(validateComponentPlan(plan)).includes('contrast-pairs-missing'));
});

test('an invalid contrast kind is an error', () => {
  const plan = craftPlan();
  plan.designIntent = {
    ...plan.designIntent,
    contrastPairs: [{ foreground: '#111111', background: '#ffffff', kind: 'body' }],
  };
  const result = validateComponentPlan(plan);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === 'invalid-contrast-kind'));
});
