/**
 * App icon generator.
 *
 *   node scripts/generate-icons.mjs
 *
 * Renders every icon asset from one analytic description of the artwork —
 * no image editor, no design file, and deliberately **no dependencies**: the
 * shapes are evaluated per pixel and the PNG is encoded with Node's built-in
 * zlib. Change a colour or a curve below and re-run.
 *
 * The mark is the app's own identity: its clear-night sky palette with aurora
 * curtains over it. Nothing else in a phone's app grid looks like it.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'assets/images');

/* ------------------------------------------------------------------ *
 * PNG encoding
 * ------------------------------------------------------------------ */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** RGBA8 buffer -> PNG. */
function encodePng(width, height, rgba) {
  // One filter byte (0 = none) per scanline, then the row's pixels.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ *
 * Colour helpers
 * ------------------------------------------------------------------ */

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** Sample a list of [position, colour] stops. */
function ramp(stops, t) {
  const x = clamp01(t);
  for (let i = 0; i < stops.length - 1; i++) {
    const [p0, c0] = stops[i];
    const [p1, c1] = stops[i + 1];
    if (x >= p0 && x <= p1) return mix(c0, c1, (x - p0) / (p1 - p0));
  }
  return stops[x < stops[0][0] ? 0 : stops.length - 1][1];
}

/* ------------------------------------------------------------------ *
 * Artwork
 * ------------------------------------------------------------------ */

// The app's clear-night palette, straight from src/sky/palettes.ts.
const SKY = [
  [0.0, hex('#01030E')],
  [0.42, hex('#061029')],
  [0.74, hex('#0C1B42')],
  [1.0, hex('#17305F')],
];

/**
 * Aurora colour from top of the curtain to its base.
 *
 * Violet above, green below — nitrogen sits higher in the atmosphere than the
 * oxygen emission. Reversing these is the detail that makes drawn aurora look
 * invented.
 */
const AURORA = [
  [0.0, hex('#C77CFF')],
  [0.3, hex('#8E7CFF')],
  [0.6, hex('#35D0FF')],
  [1.0, hex('#49E39A')],
];

/**
 * The curtains.
 *
 * Vertical, because that is how aurora actually hangs — and because a vertical
 * formation gives the icon a silhouette that survives being shrunk to 48px,
 * where a horizontal smear turns to mush.
 */
const CURTAINS = [
  { x: 0.295, amp: 0.030, freq: 1.05, phase: 0.0, thickness: 0.048, top: 0.26, base: 0.88, gain: 0.84 },
  { x: 0.425, amp: 0.038, freq: 0.85, phase: 1.9, thickness: 0.060, top: 0.16, base: 0.90, gain: 1.0 },
  { x: 0.565, amp: 0.032, freq: 1.25, phase: 3.6, thickness: 0.054, top: 0.20, base: 0.895, gain: 0.95 },
  { x: 0.700, amp: 0.026, freq: 1.0, phase: 5.2, thickness: 0.040, top: 0.30, base: 0.875, gain: 0.7 },
];

/** Fixed star field, kept above the curtains. */
const STARS = [
  [0.15, 0.16, 0.95], [0.27, 0.10, 0.55], [0.50, 0.09, 0.85], [0.63, 0.15, 0.5],
  [0.80, 0.12, 0.9], [0.87, 0.26, 0.55], [0.12, 0.30, 0.6], [0.72, 0.05, 0.6],
  [0.38, 0.16, 0.45], [0.93, 0.17, 0.5], [0.22, 0.23, 0.4], [0.57, 0.24, 0.35],
];

/** Ground line — a shallow curve, so the curtains stand on something. */
function horizon(x) {
  return 0.875 + 0.018 * Math.sin(x * Math.PI * 1.4 + 0.5);
}

/**
 * Coverage and colour of the mark (curtains + stars) at a point, with no
 * background. Returns [r, g, b, alpha 0..1].
 */
function mark(x, y) {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;

  for (const c of CURTAINS) {
    // The fold: the curtain waves from side to side as it rises.
    const centre = c.x + c.amp * Math.sin(c.freq * Math.PI * 2 * y + c.phase);
    const dx = (x - centre) / c.thickness;
    let v = Math.exp(-dx * dx) * c.gain;
    if (v < 0.004) continue;

    /*
     * Fades in at the top, then dissolves gradually into the ground wash.
     * A late, sharp cut-off gave every curtain a rounded cap and the whole
     * mark read as a row of fingers.
     */
    const t = clamp01((y - c.top) / (c.base - c.top));
    v *= smoothstep(0, 0.32, t) * (1 - smoothstep(0.6, 1.02, t));
    if (v < 0.004) continue;

    // Brightest near the base, where real emission is densest.
    const glow = v * lerp(0.6, 1.35, t);
    const colour = ramp(AURORA, t);

    r += colour[0] * glow;
    g += colour[1] * glow;
    b += colour[2] * glow;
    a = Math.max(a, Math.min(1, v * 1.1));
  }

  // Diffuse wash where the curtains meet the ground, tying them together.
  const hy = horizon(x);
  const wash =
    Math.exp(-(((y - hy + 0.085) / 0.10) ** 2)) *
    Math.exp(-(((x - 0.5) / 0.34) ** 2)) *
    0.62;
  if (wash > 0.004) {
    const colour = hex('#49E39A');
    r += colour[0] * wash;
    g += colour[1] * wash;
    b += colour[2] * wash;
    a = Math.max(a, Math.min(1, wash));
  }

  for (const [sx, sy, mag] of STARS) {
    const d = Math.hypot(x - sx, y - sy);
    // Tight core with a wide, faint halo.
    const core = Math.exp(-((d / 0.0055) ** 2)) * mag;
    const halo = Math.exp(-((d / 0.018) ** 2)) * mag * 0.25;
    const v = core + halo;
    if (v < 0.004) continue;
    r += 255 * v;
    g += 252 * v;
    b += 255 * v;
    a = Math.max(a, Math.min(1, v));
  }

  if (a <= 0) return [0, 0, 0, 0];
  // Normalise the accumulated (already alpha-weighted) colour.
  return [Math.min(255, r / a), Math.min(255, g / a), Math.min(255, b / a), a];
}

/**
 * Night sky, optionally with dark ground below the horizon.
 *
 * The ground is what the curtains stand on: without it they float in an empty
 * field and the composition has no bottom.
 *
 * It is omitted from the Android adaptive background, and must be. That layer
 * is full-bleed while the foreground is inset to the 66% safe zone, so a
 * horizon drawn here would sit far below where the inset curtains end — they
 * would visibly hover above their own ground line.
 */
function background(x, y, withGround = true) {
  const sky = ramp(SKY, y / 0.9);
  if (!withGround) return sky;

  const hy = horizon(x);
  // Soft, but only a couple of pixels wide — a horizon is a real edge.
  const land = smoothstep(hy - 0.004, hy + 0.004, y);
  return mix(sky, hex('#01020A'), land);
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

const SAMPLES = 3; // per axis, so 9 samples per pixel

/**
 * @param mode 'full'  background + mark, opaque
 *             'bg'    background only, opaque
 *             'mark'  mark only, transparent
 *             'mono'  mark silhouette in white, transparent
 * @param inset shrinks the artwork toward the centre. Android masks the outer
 *              third of an adaptive icon, so its foreground needs this.
 */
function render(size, mode, inset = 1) {
  const rgba = Buffer.alloc(size * size * 4);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const u = (px + (sx + 0.5) / SAMPLES) / size;
          const v = (py + (sy + 0.5) / SAMPLES) / size;
          // Sampling a wider region than the canvas shrinks the artwork.
          const x = 0.5 + (u - 0.5) / inset;
          const y = 0.5 + (v - 0.5) / inset;

          if (mode === 'bg') {
            const c = background(u, v, false);
            r += c[0];
            g += c[1];
            b += c[2];
            a += 255;
            continue;
          }

          const m = mark(x, y);

          if (mode === 'mark') {
            r += m[0] * m[3];
            g += m[1] * m[3];
            b += m[2] * m[3];
            a += m[3] * 255;
          } else if (mode === 'mono') {
            // Themed icons are re-tinted by the system, so only coverage
            // matters. Lifted slightly so faint curtain edges survive.
            const cov = Math.min(1, m[3] * 1.35);
            r += 255 * cov;
            g += 255 * cov;
            b += 255 * cov;
            a += cov * 255;
          } else {
            const bg = background(u, v);
            r += lerp(bg[0], m[0], m[3]);
            g += lerp(bg[1], m[1], m[3]);
            b += lerp(bg[2], m[2], m[3]);
            a += 255;
          }
        }
      }

      const n = SAMPLES * SAMPLES;
      const i = (py * size + px) * 4;
      const alpha = a / n;
      // Straight (un-premultiplied) alpha, which is what PNG stores.
      rgba[i] = Math.round(Math.min(255, alpha > 0 ? (r / n) * (255 / alpha) : 0));
      rgba[i + 1] = Math.round(Math.min(255, alpha > 0 ? (g / n) * (255 / alpha) : 0));
      rgba[i + 2] = Math.round(Math.min(255, alpha > 0 ? (b / n) * (255 / alpha) : 0));
      rgba[i + 3] = Math.round(alpha);
    }
  }

  return encodePng(size, size, rgba);
}

/* ------------------------------------------------------------------ *
 * Outputs
 * ------------------------------------------------------------------ */

/**
 * Android masks an adaptive icon down to the centre 72 of 108 dp, so anything
 * outside that circle can be clipped by the launcher's shape.
 */
const ADAPTIVE_SAFE = 72 / 108;

const TARGETS = [
  { file: 'icon.png', size: 1024, mode: 'full', inset: 1, note: 'iOS + general' },
  { file: 'android-icon-background.png', size: 1024, mode: 'bg', inset: 1, note: 'adaptive background' },
  { file: 'android-icon-foreground.png', size: 1024, mode: 'mark', inset: ADAPTIVE_SAFE, note: 'adaptive foreground' },
  { file: 'android-icon-monochrome.png', size: 1024, mode: 'mono', inset: ADAPTIVE_SAFE, note: 'themed icon' },
  { file: 'splash-icon.png', size: 1024, mode: 'mark', inset: 0.92, note: 'splash' },
  { file: 'favicon.png', size: 64, mode: 'full', inset: 1, note: 'web' },
];

mkdirSync(OUT, { recursive: true });

for (const t of TARGETS) {
  const png = render(t.size, t.mode, t.inset);
  writeFileSync(resolve(OUT, t.file), png);
  console.log(`  ${t.file.padEnd(32)} ${String(t.size).padStart(4)}px  ${(png.length / 1024).toFixed(1).padStart(6)} KB   ${t.note}`);
}

console.log('\nDone.');
