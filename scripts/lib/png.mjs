import { inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

class PngError extends Error {
  constructor(message, code = 'UNSUPPORTED_PNG') {
    super(message);
    this.name = 'PngError';
    this.code = code;
  }
}

function readChunks(buffer) {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(SIGNATURE)) {
    throw new PngError('Not a PNG file.');
  }
  const chunks = [];
  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === 'IEND') break;
  }
  return chunks;
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left;
  if (distanceUp <= distanceUpLeft) return up;
  return upLeft;
}

// Minimal PNG reader: 8-bit, non-interlaced, grayscale/RGB/RGBA; anything else throws.
export function decodePng(buffer) {
  const chunks = readChunks(buffer);
  const header = chunks.find((chunk) => chunk.type === 'IHDR');
  if (!header || header.data.length < 13) throw new PngError('PNG is missing its IHDR chunk.');

  const width = header.data.readUInt32BE(0);
  const height = header.data.readUInt32BE(4);
  const bitDepth = header.data[8];
  const colorType = header.data[9];
  const interlace = header.data[12];

  if (width === 0 || height === 0) throw new PngError('PNG has an empty canvas.');
  if (bitDepth !== 8) throw new PngError(`Only 8-bit PNGs are supported (received ${bitDepth}-bit).`);
  if (interlace !== 0) throw new PngError('Interlaced PNGs are not supported.');

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : null;
  if (!channels) throw new PngError(`Unsupported PNG color type ${colorType}.`);

  const idat = Buffer.concat(chunks.filter((chunk) => chunk.type === 'IDAT').map((chunk) => chunk.data));
  if (idat.length === 0) throw new PngError('PNG has no image data.');

  const raw = inflateSync(idat);
  const bytesPerRow = width * channels;
  const data = new Uint8Array(width * height * 4);
  const previous = Buffer.alloc(bytesPerRow);
  let position = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = raw[position];
    position += 1;
    const row = Buffer.from(raw.subarray(position, position + bytesPerRow));
    position += bytesPerRow;

    for (let index = 0; index < bytesPerRow; index += 1) {
      const left = index >= channels ? row[index - channels] : 0;
      const up = previous[index];
      const upLeft = index >= channels ? previous[index - channels] : 0;
      switch (filter) {
        case 0:
          break;
        case 1:
          row[index] = (row[index] + left) & 0xff;
          break;
        case 2:
          row[index] = (row[index] + up) & 0xff;
          break;
        case 3:
          row[index] = (row[index] + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4:
          row[index] = (row[index] + paethPredictor(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new PngError(`Unknown PNG filter type ${filter}.`);
      }
    }

    row.copy(previous);
    for (let x = 0; x < width; x += 1) {
      const source = x * channels;
      const target = (y * width + x) * 4;
      if (channels === 4) {
        data[target] = row[source];
        data[target + 1] = row[source + 1];
        data[target + 2] = row[source + 2];
        data[target + 3] = row[source + 3];
      } else if (channels === 3) {
        data[target] = row[source];
        data[target + 1] = row[source + 1];
        data[target + 2] = row[source + 2];
        data[target + 3] = 255;
      } else {
        const value = row[source];
        data[target] = value;
        data[target + 1] = value;
        data[target + 2] = value;
        data[target + 3] = 255;
      }
    }
  }

  return { width, height, data };
}
