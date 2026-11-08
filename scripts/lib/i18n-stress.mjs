const PLACEHOLDER = /\{\{?\s*[\w.]+\s*\}?\}|%[sdif]|%\d+\$[sd]|\$\{[^}]+\}/g;
// A capturing group keeps the placeholders in the split result instead of discarding them.
const PLACEHOLDER_SPLIT = new RegExp(`(${PLACEHOLDER.source})`, 'g');

const ACCENTS = {
  a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', c: 'ç', n: 'ñ', s: 'š', y: 'ý', z: 'ž',
  A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú', C: 'Ç', N: 'Ñ', S: 'Š', Y: 'Ý', Z: 'Ž',
};

export function flattenMessages(value, prefix = '', output = {}) {
  if (value === null || value === undefined) return output;
  if (typeof value !== 'object') {
    if (Object.hasOwn(output, prefix)) throw new Error(`Duplicate message key "${prefix}".`);
    Object.defineProperty(output, prefix, {
      value: String(value), enumerable: true, configurable: true, writable: true,
    });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flattenMessages(item, prefix ? `${prefix}.${index}` : String(index), output));
    return output;
  }
  for (const [key, item] of Object.entries(value)) {
    flattenMessages(item, prefix ? `${prefix}.${key}` : key, output);
  }
  return output;
}

export function placeholdersOf(text) {
  return new Set(String(text).match(PLACEHOLDER) ?? []);
}

// Pseudo-localization: accent the letters, then pad to the expansion target so width
// pressure shows up in a screenshot instead of in production. Placeholders are copied
// verbatim — a pseudo locale that breaks `{count}` would make the check lie.
export function pseudoLocalize(text, expansion = 1.35) {
  const source = String(text);
  const segments = source.split(PLACEHOLDER_SPLIT);
  const accented = segments
    .map((segment, index) => (
      index % 2 === 1 ? segment : segment.replace(/[aeioucnsyzAEIOUCNSYZ]/g, (char) => ACCENTS[char] ?? char)
    ))
    .join('');
  const target = Math.ceil(source.length * expansion);
  const padding = Math.max(0, target - accented.length);
  return `⟦${accented}${'·'.repeat(padding)}⟧`;
}

function samePlaceholders(first, second) {
  if (first.size !== second.size) return false;
  for (const placeholder of first) if (!second.has(placeholder)) return false;
  return true;
}

export function analyzeLocales(locales, {
  baseline,
  maxExpansion = 1.6,
  warnExpansion = 1.3,
  // Short labels ("Save" -> "Speichern") expand by nature; ratio checks there are noise.
  minExpansionLength = 12,
} = {}) {
  const names = Object.keys(locales ?? {});
  if (names.length === 0) throw new Error('No locale messages were provided.');

  const defaultBaseline = Object.hasOwn(locales, 'en') ? 'en' : names[0];
  const baselineName = baseline && Object.hasOwn(locales, baseline) ? baseline : defaultBaseline;
  const baselineMessages = locales[baselineName];
  const baselineKeys = Object.keys(baselineMessages);
  const issues = [];
  const report = [];

  for (const name of names) {
    const messages = locales[name];
    const keys = Object.keys(messages);
    const missing = baselineKeys.filter((key) => !Object.hasOwn(messages, key));
    const extra = keys.filter((key) => !Object.hasOwn(baselineMessages, key));
    const expansion = { max: 1, mean: 1, worstKey: null };
    let totalRatio = 0;
    let compared = 0;

    if (name === baselineName) {
      for (const key of extra) {
        issues.push({ severity: 'warning', code: 'extra-key', locale: name, key, message: `Key ${key} is not in the baseline.` });
      }
    } else {
      for (const key of missing) {
        issues.push({ severity: 'error', code: 'missing-key', locale: name, key, message: `Missing key ${key}.` });
      }
      for (const key of extra) {
        issues.push({ severity: 'warning', code: 'extra-key', locale: name, key, message: `Key ${key} is not in the baseline.` });
      }
    }

    for (const key of baselineKeys) {
      if (!Object.hasOwn(messages, key)) continue;
      const value = messages[key];
      const source = baselineMessages[key];

      if (String(value).trim() === '') {
        issues.push({ severity: 'error', code: 'empty-value', locale: name, key, message: `Value for ${key} is empty.` });
        continue;
      }

      const sourcePlaceholders = placeholdersOf(source);
      const valuePlaceholders = placeholdersOf(value);
      if (!samePlaceholders(sourcePlaceholders, valuePlaceholders)) {
        issues.push({
          severity: 'error',
          code: 'placeholder-mismatch',
          locale: name,
          key,
          message: `Placeholders differ: [${[...sourcePlaceholders].join(', ')}] vs [${[...valuePlaceholders].join(', ')}].`,
        });
      }

      if (name !== baselineName && String(source).length >= minExpansionLength) {
        const ratio = String(value).length / Math.max(1, String(source).length);
        totalRatio += ratio;
        compared += 1;
        if (ratio > expansion.max) {
          expansion.max = Number(ratio.toFixed(2));
          expansion.worstKey = key;
        }
        if (ratio > maxExpansion) {
          issues.push({
            severity: 'error',
            code: 'expansion-too-large',
            locale: name,
            key,
            message: `${key} expands ${ratio.toFixed(2)}x (limit ${maxExpansion}x).`,
          });
        } else if (ratio > warnExpansion) {
          issues.push({
            severity: 'warning',
            code: 'expansion-large',
            locale: name,
            key,
            message: `${key} expands ${ratio.toFixed(2)}x; verify the layout at that width.`,
          });
        }
      }
    }

    if (compared > 0) expansion.mean = Number((totalRatio / compared).toFixed(2));

    report.push({
      name,
      isBaseline: name === baselineName,
      keyCount: keys.length,
      missing: missing.length,
      extra: extra.length,
      expansion: name === baselineName ? null : expansion,
    });
  }

  return {
    baseline: baselineName,
    locales: report,
    issues,
    summary: {
      errors: issues.filter((issue) => issue.severity === 'error').length,
      warnings: issues.filter((issue) => issue.severity === 'warning').length,
    },
  };
}

export function pseudoLocale(messages, expansion = 1.35) {
  return Object.fromEntries(Object.entries(messages).map(([key, value]) => [key, pseudoLocalize(value, expansion)]));
}
