const NAMED_COLORS = new Map([
  ['transparent', { r: 0, g: 0, b: 0, a: 0 }],
  ['white', { r: 255, g: 255, b: 255, a: 1 }],
  ['black', { r: 0, g: 0, b: 0, a: 1 }],
]);

const LEVELS = {
  AA: { text: 4.5, large: 3, ui: 3 },
  AAA: { text: 7, large: 4.5, ui: 3 },
};

class ColorParseError extends Error {
  constructor(message, code = 'UNSUPPORTED_COLOR') {
    super(message);
    this.name = 'ColorParseError';
    this.code = code;
  }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clamp01 = (value) => clamp(value, 0, 1);
const round2 = (value) => Math.round(value * 100) / 100;

function parseHex(value) {
  const hex = value.slice(1);
  if (![3, 4, 6, 8].includes(hex.length) || !/^[0-9a-f]+$/.test(hex)) {
    throw new ColorParseError(`Unsupported hex color: ${value}`);
  }
  const expanded = hex.length <= 4 ? hex.split('').map((char) => char + char).join('') : hex;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
    a: expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
  };
}

function parseFraction(token) {
  const text = String(token).trim();
  const numeric = Number.parseFloat(text);
  if (!Number.isFinite(numeric)) throw new ColorParseError(`Unsupported channel value: ${token}`);
  if (text.endsWith('%')) return clamp01(numeric / 100);
  return clamp01(numeric > 1 ? numeric / 100 : numeric);
}

function parseChannel(token) {
  const text = String(token).trim();
  const numeric = Number.parseFloat(text);
  if (!Number.isFinite(numeric)) throw new ColorParseError(`Unsupported channel value: ${token}`);
  return clamp(text.endsWith('%') ? (numeric / 100) * 255 : numeric, 0, 255);
}

function parseHue(token) {
  const text = String(token).trim().toLowerCase();
  const numeric = Number.parseFloat(text);
  if (!Number.isFinite(numeric)) throw new ColorParseError(`Unsupported hue: ${token}`);
  if (text.endsWith('rad')) return (numeric * 180) / Math.PI;
  if (text.endsWith('turn')) return numeric * 360;
  if (text.endsWith('grad')) return numeric * 0.9;
  return numeric;
}

function parseAlpha(token) {
  if (token === undefined) return 1;
  const text = String(token).trim();
  if (!text) return 1;
  const numeric = Number.parseFloat(text);
  if (!Number.isFinite(numeric)) throw new ColorParseError(`Unsupported alpha: ${token}`);
  return clamp01(text.endsWith('%') ? numeric / 100 : numeric);
}

function hslToRgb(hue, saturation, lightness) {
  const h = ((hue % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb;
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = lightness - c / 2;
  return rgb.map((channel) => (channel + m) * 255);
}

function linearToSrgb(channel) {
  const value = channel <= 0.0031308
    ? 12.92 * channel
    : 1.055 * channel ** (1 / 2.4) - 0.055;
  return clamp01(value) * 255;
}

function oklabToSrgb(lightness, a, b) {
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return linear.map(linearToSrgb);
}

function splitChannels(body) {
  const [channelPart, alphaPart] = body.split('/');
  const channels = channelPart.trim().split(/[\s,]+/).filter(Boolean);
  return { channels, alpha: parseAlpha(alphaPart) };
}

export function parseColor(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new ColorParseError('Color must be a non-empty string.');
  }
  const value = input.trim().toLowerCase();

  if (NAMED_COLORS.has(value)) return { ...NAMED_COLORS.get(value) };
  if (value.startsWith('#')) return parseHex(value);
  if (value.startsWith('color-mix(')) {
    throw new ColorParseError(`color-mix() must be resolved before a contrast check: ${input}`);
  }

  const functional = value.match(/^([a-z]+)\((.*)\)$/);
  if (!functional) throw new ColorParseError(`Unsupported color: ${input}`);
  const [, name, body] = functional;

  if (name === 'rgb' || name === 'rgba') {
    const { channels, alpha } = splitChannels(body);
    if (channels.length !== 3) throw new ColorParseError(`rgb() needs three channels: ${input}`);
    const [r, g, b] = channels.map(parseChannel);
    return { r, g, b, a: alpha };
  }

  if (name === 'hsl' || name === 'hsla') {
    const { channels, alpha } = splitChannels(body);
    if (channels.length !== 3) throw new ColorParseError(`hsl() needs three channels: ${input}`);
    const [h, s, l] = channels;
    const [r, g, b] = hslToRgb(parseHue(h), parseFraction(s), parseFraction(l));
    return { r, g, b, a: alpha };
  }

  if (name === 'oklch' || name === 'oklab') {
    const { channels, alpha } = splitChannels(body);
    if (channels.length !== 3) throw new ColorParseError(`${name}() needs three channels: ${input}`);
    const lightness = parseFraction(channels[0]);
    let a;
    let b;
    if (name === 'oklch') {
      const chroma = String(channels[1]).trim().endsWith('%')
        ? (Number.parseFloat(channels[1]) / 100) * 0.4
        : Number.parseFloat(channels[1]);
      if (!Number.isFinite(chroma)) throw new ColorParseError(`Unsupported chroma: ${channels[1]}`);
      const hue = (parseHue(channels[2]) * Math.PI) / 180;
      a = chroma * Math.cos(hue);
      b = chroma * Math.sin(hue);
    } else {
      a = String(channels[1]).trim().endsWith('%') ? (Number.parseFloat(channels[1]) / 100) * 0.4 : Number.parseFloat(channels[1]);
      b = String(channels[2]).trim().endsWith('%') ? (Number.parseFloat(channels[2]) / 100) * 0.4 : Number.parseFloat(channels[2]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) throw new ColorParseError(`Unsupported oklab channels: ${input}`);
    }
    const [r, g, bl] = oklabToSrgb(lightness, a, b);
    return { r, g, b: bl, a: alpha };
  }

  throw new ColorParseError(`Unsupported color function: ${name}()`);
}

export function toHex(color) {
  const channel = (value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
  return `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`;
}

function channelLuminance(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color) {
  return 0.2126 * channelLuminance(color.r)
    + 0.7152 * channelLuminance(color.g)
    + 0.0722 * channelLuminance(color.b);
}

function srgbToLinear(value) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function toOklab(color) {
  const r = srgbToLinear(color.r);
  const g = srgbToLinear(color.g);
  const b = srgbToLinear(color.b);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);
  return {
    L: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  };
}

// OKLab distance is close enough to perceptual distance for "is this color in the theme?"
export function oklabDistance(first, second) {
  const a = toOklab(first);
  const b = toOklab(second);
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

function compositeOver(foreground, background) {
  const alpha = foreground.a;
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    a: 1,
  };
}

export function contrastRatio(foreground, background) {
  if (background.a < 1) {
    throw new ColorParseError(
      'Background must be opaque; composite a translucent surface over its real backdrop first.',
      'ALPHA_BACKGROUND',
    );
  }
  const resolved = foreground.a < 1 ? compositeOver(foreground, background) : foreground;
  const first = relativeLuminance(resolved);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function normalizeTokenName(name) {
  return String(name ?? '').replace(/^--/, '').trim().toLowerCase();
}

function tokenValueMap(variables = []) {
  const values = new Map();
  for (const token of variables) {
    if (!token || typeof token.name !== 'string' || typeof token.value !== 'string') continue;
    const name = normalizeTokenName(token.name);
    if (name && !values.has(name)) values.set(name, token.value.trim());
  }
  return values;
}

const COLOR_FUNCTION = /^[a-z-]+\(/i;

// Resolves a literal color, var(--token), or bare token name to a concrete color string.
export function resolveColorReference(value, variables = []) {
  const text = String(value ?? '').trim();
  if (!text) return { value: null, reason: 'empty' };

  const values = tokenValueMap(variables);

  const declared = text.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i);
  if (declared) {
    const name = normalizeTokenName(declared[1]);
    if (values.has(name)) return { value: values.get(name), token: name };
    return { value: null, reason: `unknown token ${name}` };
  }

  if (text.startsWith('#') || COLOR_FUNCTION.test(text) || NAMED_COLORS.has(text.toLowerCase())) {
    return { value: text };
  }

  const name = normalizeTokenName(text);
  if (values.has(name)) return { value: values.get(name), token: name };
  return { value: null, reason: `unknown token ${name}` };
}

// Proposes the pairs a themed surface actually needs to pass.
export function deriveTokenPairs(variables = []) {
  const values = tokenValueMap(variables);
  const pairs = [];
  const seen = new Set();

  const add = (foreground, background, kind) => {
    const key = `${foreground}|${background}`;
    if (seen.has(key) || !values.has(foreground) || !values.has(background)) return;
    seen.add(key);
    pairs.push({
      foreground,
      background,
      kind,
      foregroundValue: values.get(foreground),
      backgroundValue: values.get(background),
    });
  };

  for (const surface of ['background', 'card', 'popover', 'muted', 'accent', 'secondary']) {
    add('foreground', surface, 'text');
  }
  for (const name of [...values.keys()]) {
    if (!name.endsWith('-foreground')) continue;
    add(name, name.slice(0, -'-foreground'.length), 'text');
  }
  add('muted-foreground', 'background', 'text');
  add('primary', 'background', 'text');
  add('destructive', 'background', 'text');
  add('border', 'background', 'ui');
  add('input', 'background', 'ui');
  add('ring', 'background', 'ui');

  return pairs;
}

export function resolveTokenPairs(variables = [], specs = []) {
  const values = tokenValueMap(variables);
  return specs.map((spec) => {
    const [foregroundName, backgroundName] = String(spec).split(':').map((part) => normalizeTokenName(part));
    if (!foregroundName || !backgroundName) {
      throw new ColorParseError(`Token pair must look like "foreground:background": ${spec}`, 'INVALID_PAIR');
    }
    const foregroundValue = values.get(foregroundName);
    const backgroundValue = values.get(backgroundName);
    const missing = [
      foregroundValue === undefined ? foregroundName : null,
      backgroundValue === undefined ? backgroundName : null,
    ].filter(Boolean);
    if (missing.length) {
      const available = [...values.keys()].sort().slice(0, 12).join(', ');
      throw new ColorParseError(
        `Unknown token(s): ${missing.join(', ')}. Available tokens include: ${available}`,
        'UNKNOWN_TOKEN',
      );
    }
    return {
      label: `${foregroundName} on ${backgroundName}`,
      foreground: foregroundValue,
      background: backgroundValue,
      // Borders, dividers, and focus rings are UI boundaries, not text.
      kind: /^(border|input|ring)$/.test(foregroundName) ? 'ui' : 'text',
    };
  });
}

export function checkContrast(pairs = [], { level = 'AA' } = {}) {
  if (!LEVELS[level]) throw new Error(`Unknown level: ${level}. Use AA or AAA.`);

  const results = pairs.map((pair) => {
    const kind = pair.kind === 'large' || pair.kind === 'ui' ? pair.kind : 'text';
    const required = LEVELS[level][kind];
    const label = pair.label ?? '';
    try {
      const foreground = parseColor(pair.foreground);
      const background = parseColor(pair.background);
      const ratio = contrastRatio(foreground, background);
      return {
        label,
        kind,
        required,
        ratio: round2(ratio),
        pass: ratio + 1e-9 >= required,
        foregroundHex: toHex(foreground),
        backgroundHex: toHex(background),
      };
    } catch (error) {
      return { label, kind, required, ratio: null, pass: false, error: error.message };
    }
  });

  const failed = results.filter((result) => !result.pass).length;
  return {
    level,
    pairs: results,
    summary: { total: results.length, passed: results.length - failed, failed },
  };
}

export { LEVELS };
