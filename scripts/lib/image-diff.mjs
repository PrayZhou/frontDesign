const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;

function channelDistance(baseline, current) {
  return Math.max(
    Math.abs(baseline[0] - current[0]),
    Math.abs(baseline[1] - current[1]),
    Math.abs(baseline[2] - current[2]),
  );
}

function sampleGray(image, x, y) {
  const sourceX = Math.min(image.width - 1, Math.floor(((x + 0.5) * image.width) / HASH_WIDTH));
  const sourceY = Math.min(image.height - 1, Math.floor(((y + 0.5) * image.height) / HASH_HEIGHT));
  const offset = (sourceY * image.width + sourceX) * 4;
  const alpha = image.data[offset + 3] / 255;
  return (
    0.2126 * image.data[offset] * alpha
    + 0.7152 * image.data[offset + 1] * alpha
    + 0.0722 * image.data[offset + 2] * alpha
    + 255 * (1 - alpha)
  );
}

// Difference hash: 64 bits of coarse structure, used to report "same layout, different
// pixels" versus "different page" when a screenshot changes.
export function differenceHash(image) {
  const gray = [];
  for (let y = 0; y < HASH_HEIGHT; y += 1) {
    for (let x = 0; x < HASH_WIDTH; x += 1) gray.push(sampleGray(image, x, y));
  }
  let bits = 0n;
  for (let y = 0; y < HASH_HEIGHT; y += 1) {
    for (let x = 0; x < HASH_WIDTH - 1; x += 1) {
      const index = y * HASH_WIDTH + x;
      bits = (bits << 1n) | (gray[index] < gray[index + 1] ? 1n : 0n);
    }
  }
  return bits;
}

export function hammingDistance(first, second) {
  let value = first ^ second;
  let count = 0;
  while (value) {
    count += Number(value & 1n);
    value >>= 1n;
  }
  return count;
}

export function compareImages(baseline, current, { tolerance = 12 } = {}) {
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return {
      sizeChanged: true,
      baselineSize: { width: baseline.width, height: baseline.height },
      currentSize: { width: current.width, height: current.height },
      ratio: 1,
      changedPixels: baseline.width * baseline.height,
      totalPixels: baseline.width * baseline.height,
      bbox: null,
      tolerance,
      hashDistance: 64,
    };
  }

  const { width, height } = baseline;
  const total = width * height;
  let changedPixels = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;

  for (let index = 0; index < total; index += 1) {
    const offset = index * 4;
    const baselinePixel = [baseline.data[offset], baseline.data[offset + 1], baseline.data[offset + 2]];
    const currentPixel = [current.data[offset], current.data[offset + 1], current.data[offset + 2]];
    if (channelDistance(baselinePixel, currentPixel) <= tolerance) continue;

    changedPixels += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return {
    sizeChanged: false,
    ratio: changedPixels / total,
    changedPixels,
    totalPixels: total,
    bbox: changedPixels === 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    tolerance,
    hashDistance: hammingDistance(differenceHash(baseline), differenceHash(current)),
  };
}
