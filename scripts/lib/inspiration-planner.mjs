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
