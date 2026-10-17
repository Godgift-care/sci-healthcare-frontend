/**
 * Generates the PWA icons in `public/icons` (#74).
 *
 * `npm run icons` rewrites them. They are checked in because a deployment
 * should not need a build step to have an installable app, and they are
 * generated rather than hand-drawn so they stay reproducible: a rounded
 * brand-coloured square with the same white cross the header uses.
 *
 * No image library: a PNG is four chunks and a zlib stream, and Node has
 * zlib built in. Nothing here runs at build time — this is a one-off tool.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** --color-brand and --color-surface from src/app/globals.css. */
const BRAND = [0x0f, 0x76, 0x6e];
const WHITE = [0xff, 0xff, 0xff];

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const payload = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(payload));
  return Buffer.concat([length, payload, crc]);
}

function encodePng(size, pixel) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10..12: deflate compression, adaptive filtering, no interlace — all 0.

  // Each scanline is prefixed with its filter type (0: none).
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      const at = rowStart + 1 + x * 4;
      raw[at] = r;
      raw[at + 1] = g;
      raw[at + 2] = b;
      raw[at + 3] = a;
    }
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * One icon.
 *
 * `rounded` gives a squircle-ish tile (the header logo's shape, and what
 * Android uses for `purpose: "any"`); without it the icon is full bleed and
 * the cross sits inside the safe zone, which is what `maskable` needs — the
 * launcher is allowed to crop it to a circle.
 */
function draw(size, { rounded = true, glyphScale = 0.56, radius = 0.22 } = {}) {
  const centre = (size - 1) / 2;
  const corner = radius * size;
  const armHalf = (glyphScale * size) / 2;
  const barHalf = (0.16 * size) / 2;

  return (x, y) => {
    if (rounded) {
      // Distance outside the rounded rectangle: negative inside.
      const dx = Math.max(corner - x, x - (size - 1 - corner), 0);
      const dy = Math.max(corner - y, y - (size - 1 - corner), 0);
      if (Math.hypot(dx, dy) > corner) return [0, 0, 0, 0];
    }

    const onHorizontal = Math.abs(y - centre) <= barHalf && Math.abs(x - centre) <= armHalf;
    const onVertical = Math.abs(x - centre) <= barHalf && Math.abs(y - centre) <= armHalf;
    return onHorizontal || onVertical ? [...WHITE, 255] : [...BRAND, 255];
  };
}

const ICONS = [
  // `any`: rounded tile, generous glyph.
  { file: 'icon-192.png', size: 192, options: {} },
  { file: 'icon-512.png', size: 512, options: {} },
  // `maskable`: full bleed, glyph well inside the safe area.
  {
    file: 'icon-maskable-512.png',
    size: 512,
    options: { rounded: false, glyphScale: 0.36 },
  },
  // iOS home screen: it applies its own mask, so no transparency.
  {
    file: 'apple-touch-icon.png',
    size: 180,
    options: { rounded: false, glyphScale: 0.44 },
  },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const { file, size, options } of ICONS) {
  const png = encodePng(size, draw(size, options));
  writeFileSync(join(OUT_DIR, file), png);
  console.log(`${file} — ${size}x${size}, ${png.length} bytes`);
}
