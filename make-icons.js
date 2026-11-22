// Generates PWA icons (valid PNG, no deps) - run: node make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function writePNG(file, size, pixelFn) {
  // pixelFn(x,y) -> [r,g,b,a] with x,y in [0,1)
  const SS = 3; // supersample
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter none
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          const c = pixelFn(u, v);
          r += c[0] * c[3]; g += c[1] * c[3]; b += c[2] * c[3]; a += c[3];
        }
      }
      const n = SS * SS;
      if (a > 0) { raw[o++] = Math.round(r / a); raw[o++] = Math.round(g / a); raw[o++] = Math.round(b / a); }
      else { raw[o++] = 0; raw[o++] = 0; raw[o++] = 0; }
      raw[o++] = Math.round((a / n) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  console.log('wrote', file, png.length, 'bytes');
}

// ---- glyph: interlocking chain rings (diagonal), Shopee orange bg ----
const ORANGE = [238, 77, 45];
const DARK = [214, 61, 31];

function ring(u, v, cx, cy, rx, ry, rot, tk) {
  const rad = (rot * Math.PI) / 180;
  const dx = u - cx, dy = v - cy;
  const x = dx * Math.cos(rad) + dy * Math.sin(rad);
  const y = -dx * Math.sin(rad) + dy * Math.cos(rad);
  const qo = (x / rx) ** 2 + (y / ry) ** 2;
  const qi = (x / (rx - tk)) ** 2 + (y / (ry - tk)) ** 2;
  return qo <= 1 && qi >= 1;
}

function inRoundedSquare(u, v, r) {
  const x = Math.min(u, 1 - u), y = Math.min(v, 1 - v);
  if (u >= r && u <= 1 - r) return true;
  if (v >= r && v <= 1 - r) return true;
  const cx = Math.max(r - u, 0), cy = Math.max(r - v, 0);
  return cx * cx + cy * cy <= r * r;
}

function pixelFn(u, v) {
  // background: orange with subtle vertical gradient
  const bg = u;
  const bgc = [ORANGE[0] - 10 * v * 0.6, ORANGE[1] - 12 * v, ORANGE[2] - 8 * v];
  if (!inRoundedSquare(u, v, 0.001)) return [0, 0, 0, 0];
  let white = false;
  const rings = [
    [0.42, 0.42, 0.185, 0.105, 45, 0.045],
    [0.60, 0.60, 0.185, 0.105, 45, 0.045],
  ];
  for (const [cx, cy, rx, ry, rot, tk] of rings) {
    if (ring(u, v, cx, cy, rx, ry, rot, tk)) white = true;
  }
  return white ? [255, 255, 255, 255] : [...bgc, 255];
}

const out = path.join(__dirname, 'public');
fs.mkdirSync(out, { recursive: true });
writePNG(path.join(out, 'icon-192.png'), 192, pixelFn);
writePNG(path.join(out, 'icon-512.png'), 512, pixelFn);
