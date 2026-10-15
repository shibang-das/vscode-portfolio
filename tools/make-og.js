#!/usr/bin/env node
/* ────────────────────────────────────────────────────────────────
   make-og.js — turn a screenshot into the link-preview image.

     node tools/make-og.js my-screenshot.png

   Centre-crops to 1.91:1 (what LinkedIn, Slack and X all crop to
   anyway, so better to choose the framing than let them) and box-
   downscales to 1200x630, writing public/assets/og.png.

   PNG in, PNG out, no dependencies: zlib does the compression, the
   rest is scanline work. 8-bit RGB or RGBA, non-interlaced — which is
   what every screenshot tool produces.
   ──────────────────────────────────────────────────────────────── */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const OUT_W = 1200, OUT_H = 630;

/* ── decode ───────────────────────────────────────────────────── */
function decode(file) {
  const b = fs.readFileSync(file);
  if (b.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
    throw new Error(`${file} is not a PNG. Save the screenshot as PNG and retry.`);

  let pos = 8, idat = [], w = 0, h = 0, depth = 0, colour = 0;
  while (pos < b.length) {
    const len = b.readUInt32BE(pos);
    const type = b.subarray(pos + 4, pos + 8).toString('ascii');
    const data = b.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; colour = data[9];
      if (depth !== 8) throw new Error(`unsupported bit depth ${depth} — need 8`);
      if (colour !== 2 && colour !== 6) throw new Error(`unsupported colour type ${colour} — need RGB or RGBA`);
      if (data[12] !== 0) throw new Error('interlaced PNGs are not supported');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }

  const ch = colour === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(w * h * 3);
  const stride = w * ch;
  let prev = Buffer.alloc(stride);

  /* undo the per-scanline filter — this is the whole of PNG decoding
     once zlib has run */
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? line[i - ch] : 0, up = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += up;
      else if (filter === 3) v += (a + up) >> 1;
      else if (filter === 4) {
        const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      line[i] = v & 0xff;
    }
    for (let x = 0; x < w; x++) {
      out[(y * w + x) * 3] = line[x * ch];
      out[(y * w + x) * 3 + 1] = line[x * ch + 1];
      out[(y * w + x) * 3 + 2] = line[x * ch + 2];
    }
    prev = line;
  }
  return { w, h, px: out };
}

/* ── crop to aspect, then box-downscale ───────────────────────── */
function resize(src) {
  const target = OUT_W / OUT_H;
  let cw = src.w, chh = Math.round(src.w / target);
  if (chh > src.h) { chh = src.h; cw = Math.round(src.h * target); }
  const ox = Math.floor((src.w - cw) / 2), oy = Math.floor((src.h - chh) / 2);

  const out = Buffer.alloc(OUT_W * OUT_H * 3);
  for (let y = 0; y < OUT_H; y++) {
    const y0 = oy + Math.floor(y * chh / OUT_H), y1 = Math.max(y0 + 1, oy + Math.floor((y + 1) * chh / OUT_H));
    for (let x = 0; x < OUT_W; x++) {
      const x0 = ox + Math.floor(x * cw / OUT_W), x1 = Math.max(x0 + 1, ox + Math.floor((x + 1) * cw / OUT_W));
      let r = 0, g = 0, bl = 0, n = 0;
      /* average the source pixels behind this one — a plain nearest
         sample turns 1px editor rules into aliased noise */
      for (let sy = y0; sy < y1; sy++) for (let sx = x0; sx < x1; sx++) {
        const i = (sy * src.w + sx) * 3;
        r += src.px[i]; g += src.px[i + 1]; bl += src.px[i + 2]; n++;
      }
      const o = (y * OUT_W + x) * 3;
      out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n); out[o + 2] = Math.round(bl / n);
    }
  }
  return out;
}

/* ── encode ───────────────────────────────────────────────────── */
const TABLE = [...Array(256)].map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = b => { let c = 0xffffffff; for (const x of b) c = TABLE[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(body));
  return Buffer.concat([len, body, c]);
};

function encode(px, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    px.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ── run ──────────────────────────────────────────────────────── */
const input = process.argv[2];
if (!input) {
  console.error('usage: node tools/make-og.js <screenshot.png>');
  process.exit(1);
}
const src = decode(input);
const out = encode(resize(src), OUT_W, OUT_H);
const dest = path.join(__dirname, '..', 'public', 'assets', 'og.png');
fs.writeFileSync(dest, out);
console.log(`${input} ${src.w}x${src.h} → ${OUT_W}x${OUT_H}, ${(out.length / 1024).toFixed(0)} KB`);
console.log(`wrote ${path.relative(process.cwd(), dest)}`);
