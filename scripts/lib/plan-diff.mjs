const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// Arrays with a stable identity diff by that identity, so inserting one region does not
// rewrite every following path.
const KEYED_ARRAYS = [
  { path: '/regions', key: (item) => item?.id },
  { path: '/dependencies', key: (item) => item?.name },
  { path: '/designIntent/styleDirections', key: (item) => item?.id },
  {
    path: '/designIntent/contrastPairs',
    key: (item) => `${item?.foreground}|${item?.background}|${item?.kind ?? 'text'}`,
  },
  { path: '/designIntent/evidence', key: (item) => item?.id },
];

const SET_ARRAYS = new Set(['/designIntent/principles', '/designIntent/successCriteria']);

const FAIL_ON_FLAGS = {
  foundation: 'foundationChanged',
  enhancer: 'enhancerChanged',
  designIntent: 'designIntentChanged',
  regions: 'regionsChanged',
  selection: 'selectionChanged',
  capabilities: 'capabilitiesChanged',
  states: 'statesChanged',
  dependencies: 'dependenciesChanged',
  contrastPairs: 'contrastPairsChanged',
  successCriteria: 'successCriteriaChanged',
  styleDirection: 'styleDirectionChanged',
};

function diffSet(before, after, path, changes) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  for (const value of afterSet) {
    if (!beforeSet.has(value)) changes.push({ path, type: 'added', after: value });
  }
  for (const value of beforeSet) {
    if (!afterSet.has(value)) changes.push({ path, type: 'removed', before: value });
  }
}

function diffKeyed(before, after, path, keyOf, changes) {
  const beforeMap = new Map(before.map((item, index) => [keyOf(item) ?? `#${index}`, item]));
  const afterMap = new Map(after.map((item, index) => [keyOf(item) ?? `#${index}`, item]));

  for (const [key, item] of beforeMap) {
    if (!afterMap.has(key)) changes.push({ path: `${path}/${key}`, type: 'removed', before: item });
  }
  for (const [key, item] of afterMap) {
    if (!beforeMap.has(key)) {
      changes.push({ path: `${path}/${key}`, type: 'added', after: item });
    } else {
      diffNode(beforeMap.get(key), item, `${path}/${key}`, changes);
    }
  }
}

function diffNode(before, after, path, changes) {
  if (before === undefined && after === undefined) return;
  if (JSON.stringify(before) === JSON.stringify(after)) return;

  if (isRecord(before) && isRecord(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of [...keys].sort()) diffNode(before[key], after[key], `${path}/${key}`, changes);
    return;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    if (SET_ARRAYS.has(path)) {
      diffSet(before, after, path, changes);
      return;
    }
    const rule = KEYED_ARRAYS.find((entry) => entry.path === path);
    if (rule) {
      diffKeyed(before, after, path, rule.key, changes);
      return;
    }
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      diffNode(before[index], after[index], `${path}/${index}`, changes);
    }
    return;
  }

  if (before === undefined) changes.push({ path, type: 'added', after });
  else if (after === undefined) changes.push({ path, type: 'removed', before });
  else changes.push({ path, type: 'changed', before, after });
}

function summarizeChanges(changes) {
  const has = (test) => changes.some((change) => test(change.path));
  const regionPath = /^\/regions\/[^/]+$/;
  return {
    foundationChanged: has((path) => path === '/foundation'),
    enhancerChanged: has((path) => path === '/enhancer'),
    designIntentChanged: has((path) => path === '/designIntent' || path.startsWith('/designIntent/')),
    regionsChanged: has((path) => path === '/regions' || path.startsWith('/regions/')),
    selectionChanged: has((path) => path.includes('/selection')),
    capabilitiesChanged: has((path) => path.includes('/capabilities')),
    statesChanged: has((path) => path.includes('/states')),
    dependenciesChanged: has((path) => path === '/dependencies' || path.startsWith('/dependencies/')),
    contrastPairsChanged: has((path) => path.includes('/contrastPairs')),
    successCriteriaChanged: has((path) => path.includes('/successCriteria')),
    styleDirectionChanged: has((path) => path.includes('selectedStyleDirection') || path.includes('/styleDirections')),
    addedRegions: changes.filter((change) => change.type === 'added' && regionPath.test(change.path)).map((change) => change.path.split('/')[2]),
    removedRegions: changes.filter((change) => change.type === 'removed' && regionPath.test(change.path)).map((change) => change.path.split('/')[2]),
  };
}

export function diffPlans(before, after) {
  const changes = [];
  diffNode(before, after, '', changes);
  const summary = { ...summarizeChanges(changes), total: changes.length };
  return {
    changes,
    counts: {
      total: changes.length,
      added: changes.filter((change) => change.type === 'added').length,
      removed: changes.filter((change) => change.type === 'removed').length,
      changed: changes.filter((change) => change.type === 'changed').length,
    },
    summary,
  };
}

export function evaluateFailOn(summary, failOn = []) {
  if (failOn.includes('any')) return summary.total > 0 ? ['any'] : [];
  const blocked = [];
  for (const key of failOn) {
    const flag = FAIL_ON_FLAGS[key];
    if (!flag) {
      throw new Error(`Unknown --fail-on value: ${key}. Use ${[...Object.keys(FAIL_ON_FLAGS), 'any'].join(', ')}.`);
    }
    if (summary[flag]) blocked.push(key);
  }
  return blocked;
}

export { FAIL_ON_FLAGS };
