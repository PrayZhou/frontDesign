import { promises as fs } from 'node:fs';
import path from 'node:path';
import { contrastRatio, oklabDistance, parseColor, toHex } from './contrast.mjs';
import { listFiles } from './files.mjs';
import { decodePng } from './png.mjs';
import { inspectProject } from './project-inspector.mjs';

const PNG = ['.png'];
const OTHER_IMAGES = ['.jpg', '.jpeg', '.webp', '.avif', '.gif'];
const MAX_ASSETS = 12;

// Quantizes to 4 bits per channel; shares count opaque samples only.
export function extractPalette(image, { limit = 5, minShare = 0.005 } = {}) {
  const buckets = new Map();
  const pixelCount = image.width * image.height;
  const step = Math.max(1, Math.floor(Math.sqrt(pixelCount / 40000)));
  let samples = 0;

  for (let y = 0; y < image.height; y += step) {
    for (let x = 0; x < image.width; x += step) {
      const offset = (y * image.width + x) * 4;
      if (image.data[offset + 3] < 16) continue;
      const r = image.data[offset];
      const g = image.data[offset + 1];
      const b = image.data[offset + 2];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count += 1;
      buckets.set(key, bucket);
      samples += 1;
    }
  }

  if (samples === 0) return { samples: 0, palette: [] };

  const palette = [...buckets.values()]
    .map((bucket) => ({
      r: Math.round(bucket.r / bucket.count),
      g: Math.round(bucket.g / bucket.count),
      b: Math.round(bucket.b / bucket.count),
      count: bucket.count,
    }))
    .filter((bucket) => bucket.count / samples >= minShare)
    .sort((left, right) => right.count - left.count)
    .slice(0, limit)
    .map((bucket) => ({
      hex: toHex({ r: bucket.r, g: bucket.g, b: bucket.b, a: 1 }),
      share: Number((bucket.count / samples).toFixed(4)),
    }));

  return { samples, palette };
}

export function resolveThemeColors(variables = []) {
  const colors = [];
  for (const token of variables) {
    if (!token || typeof token.name !== 'string' || typeof token.value !== 'string') continue;
    try {
      colors.push({ name: token.name, value: token.value, color: parseColor(token.value) });
    } catch {
      // Not a color token (radius, spacing, font stack): skip it.
    }
  }
  return colors;
}

function findBackgroundColor(themeColors, variables = []) {
  const named = themeColors.find((token) => /--(background|surface|canvas)$/i.test(token.name));
  if (named) return named;
  return themeColors[0] ?? null;
}

export function comparePaletteToTokens(palette, themeColors, { maxDistance = 0.12 } = {}) {
  return palette.map((entry) => {
    let color;
    try {
      color = parseColor(entry.hex);
    } catch {
      return { ...entry, nearestToken: null, distance: null, matched: false };
    }
    let nearest = null;
    for (const token of themeColors) {
      const distance = oklabDistance(color, token.color);
      if (!nearest || distance < nearest.distance) nearest = { name: token.name, value: token.value, distance };
    }
    return {
      ...entry,
      nearestToken: nearest?.name ?? null,
      distance: nearest ? Number(nearest.distance.toFixed(3)) : null,
      matched: Boolean(nearest && nearest.distance <= maxDistance),
    };
  });
}

export async function inspectBrandColors({ root = '.', assets = 'assets', limit = 5, maxDistance = 0.12 } = {}) {
  const project = await inspectProject(root);
  const variables = project.designTokens?.variables ?? [];
  const themeColors = resolveThemeColors(variables);
  const background = findBackgroundColor(themeColors, variables);

  const theme = themeColors.map((token) => ({
    name: token.name,
    value: token.value,
    hex: toHex(token.color),
    contrastWithBackground: background
      ? Number(contrastRatio(token.color, background.color).toFixed(2))
      : null,
  }));

  const warnings = [];
  const assetsDir = path.join(root, assets);
  const assetFiles = await listFiles(assetsDir, { extensions: PNG });
  const otherImages = await listFiles(assetsDir, { extensions: OTHER_IMAGES });

  const inspected = [];
  for (const file of assetFiles.slice(0, MAX_ASSETS)) {
    try {
      const image = decodePng(await fs.readFile(path.join(assetsDir, file)));
      const { samples, palette } = extractPalette(image, { limit });
      const compared = comparePaletteToTokens(palette, themeColors, { maxDistance });
      for (const entry of compared) {
        if (!entry.matched) {
          warnings.push(
            `Brand color ${entry.hex} (${(entry.share * 100).toFixed(1)}% of ${file}) has no theme token within ${maxDistance} OKLab${entry.nearestToken ? `; nearest is ${entry.nearestToken}` : ''}.`,
          );
        }
      }
      inspected.push({ file: `${assets}/${file}`, samples, palette: compared });
    } catch (error) {
      warnings.push(`Could not read ${assets}/${file}: ${error.message}`);
    }
  }

  if (assetFiles.length === 0 && otherImages.length === 0) {
    warnings.push(`No PNG assets found under ${assets}. Brand colors can only be extracted from PNG files.`);
  }
  for (const file of otherImages.slice(0, 6)) {
    warnings.push(`${assets}/${file} is not a PNG; decode it to PNG before extraction.`);
  }

  return {
    root: project.root,
    theme: {
      background: background ? { name: background.name, value: background.value, hex: toHex(background.color) } : null,
      colors: theme,
    },
    assets: inspected,
    warnings,
  };
}
