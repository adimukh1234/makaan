import { deflateSync } from 'node:zlib';

/** Minimal PNG encoder used to generate deterministic placeholder evidence
 * images for the demo seed. No image library, no native dependency. */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

export function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export interface RoomImageOptions {
  width?: number;
  height?: number;
  wall: [number, number, number];
  floor: [number, number, number];
  floorRatio?: number;
  marks?: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    color: [number, number, number];
    opacity?: number;
  }>;
}

/** Renders a simple, deterministic room sketch: a wall, a floor band and
 * optional damage marks. Enough to make the demo look real without shipping
 * binary assets. */
export function renderRoomImage(options: RoomImageOptions): Buffer {
  const width = options.width ?? 960;
  const height = options.height ?? 640;
  const floorRatio = options.floorRatio ?? 0.28;
  const floorStart = Math.floor(height * (1 - floorRatio));
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const inFloor = y >= floorStart;
    const base = inFloor ? options.floor : options.wall;
    const shade = inFloor
      ? 1 - ((y - floorStart) / Math.max(1, height - floorStart)) * 0.25
      : 1 - (y / Math.max(1, height)) * 0.12;
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const vignette = 1 - Math.abs(x / width - 0.5) * 0.14;
      rgba[index] = Math.max(0, Math.min(255, Math.round(base[0] * shade * vignette)));
      rgba[index + 1] = Math.max(0, Math.min(255, Math.round(base[1] * shade * vignette)));
      rgba[index + 2] = Math.max(0, Math.min(255, Math.round(base[2] * shade * vignette)));
      rgba[index + 3] = 255;
    }
  }

  for (const mark of options.marks ?? []) {
    const opacity = mark.opacity ?? 1;
    for (let y = mark.y; y < Math.min(height, mark.y + mark.h); y += 1) {
      for (let x = mark.x; x < Math.min(width, mark.x + mark.w); x += 1) {
        if (x < 0 || y < 0) continue;
        const index = (y * width + x) * 4;
        rgba[index] = Math.round(rgba[index] * (1 - opacity) + mark.color[0] * opacity);
        rgba[index + 1] = Math.round(rgba[index + 1] * (1 - opacity) + mark.color[1] * opacity);
        rgba[index + 2] = Math.round(rgba[index + 2] * (1 - opacity) + mark.color[2] * opacity);
      }
    }
  }

  return encodePng(width, height, rgba);
}
