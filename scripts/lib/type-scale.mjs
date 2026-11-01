const SCALE_NAMES = ['label', 'body', 'lead', 'title', 'heading', 'display', 'hero', 'mega'];

const USAGE = {
  label: 'labels, captions, table headers, metadata',
  body: 'body copy, inputs, list rows',
  lead: 'lede paragraph, section intro',
  title: 'card and section titles',
  heading: 'page headings',
  display: 'hero headline, first viewport',
  hero: 'marketing hero',
  mega: 'oversized editorial statement',
};

const WEIGHTS = {
  label: 500,
  body: 400,
  lead: 400,
  title: 600,
  heading: 600,
  display: 600,
  hero: 600,
  mega: 600,
};

const LIMITS = { minBase: 8, maxBase: 32, minRatio: 1.05, maxRatio: 1.8, minLevels: 3, maxLevels: 8 };

const halfPixel = (value) => Math.round(value * 2) / 2;

function lineHeightFor(px) {
  if (px <= 13) return 1.35;
  if (px <= 16) return 1.6;
  if (px <= 20) return 1.5;
  if (px <= 26) return 1.35;
  if (px <= 32) return 1.3;
  if (px <= 44) return 1.2;
  return 1.1;
}

function trackingFor(name) {
  if (name === 'label') return '0.02em';
  if (name === 'body' || name === 'lead') return '0';
  if (name === 'title' || name === 'heading') return '-0.01em';
  return '-0.02em';
}

function measureFor(name) {
  if (name === 'body') return '65ch';
  if (name === 'lead') return '72ch';
  if (name === 'display' || name === 'hero' || name === 'mega') return '22ch';
  return null;
}

function numericOption(value, fallback, { min, max, label }) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a number, received ${value}`);
  if (number < min || number > max) throw new Error(`${label} must be between ${min} and ${max}, received ${number}`);
  return number;
}

// One ratio, reused: every size comes from the same derivation, not ad-hoc per component.
export function buildTypeScale({ base, ratio, levels } = {}) {
  const bodySize = numericOption(base, 16, { min: LIMITS.minBase, max: LIMITS.maxBase, label: '--body' });
  const step = numericOption(ratio, 1.25, { min: LIMITS.minRatio, max: LIMITS.maxRatio, label: '--ratio' });
  const count = Math.round(numericOption(levels, 6, { min: LIMITS.minLevels, max: LIMITS.maxLevels, label: '--levels' }));

  const tokens = SCALE_NAMES.slice(0, count).map((name, index) => {
    const px = halfPixel(bodySize * step ** (index - 1));
    return {
      name,
      px,
      rem: Number((px / 16).toFixed(3)),
      lineHeight: lineHeightFor(px),
      tracking: trackingFor(name),
      weight: WEIGHTS[name],
      measure: measureFor(name),
      usage: USAGE[name],
    };
  });

  return {
    base: bodySize,
    ratio: step,
    levels: count,
    tokens,
    css: renderCss(tokens),
    recommendation: recommendLevels(tokens),
  };
}

function recommendLevels(tokens) {
  const available = new Set(tokens.map((token) => token.name));
  return ['body', 'title', 'display', 'label'].filter((name) => available.has(name));
}

function renderCss(tokens) {
  const lines = [':root {'];
  for (const token of tokens) {
    lines.push(`  --text-${token.name}: ${token.px}px;`);
    lines.push(`  --text-${token.name}-line: ${token.lineHeight};`);
    lines.push(`  --text-${token.name}-tracking: ${token.tracking};`);
    lines.push(`  --text-${token.name}-weight: ${token.weight};`);
  }
  lines.push('}');
  return lines.join('\n');
}

export function renderTypeScaleMarkdown(scale) {
  const lines = [
    `# Type scale`,
    '',
    `Base ${scale.base}px · ratio ${scale.ratio} · ${scale.levels} steps`,
    '',
    '| token | px | rem | line height | tracking | weight | measure | use for |',
    '|---|---|---|---|---|---|---|---|',
  ];
  for (const token of scale.tokens) {
    lines.push(`| ${token.name} | ${token.px} | ${token.rem} | ${token.lineHeight} | ${token.tracking} | ${token.weight} | ${token.measure ?? '—'} | ${token.usage} |`);
  }
  lines.push('');
  lines.push(`Use 3–4 of these per page; ${scale.recommendation.join(' + ')} covers most product surfaces.`);
  lines.push('');
  return lines.join('\n');
}
