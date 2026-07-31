import type { SkyPalette, SkyState } from '../types';

/**
 * Every animated layer takes the same props, which is what lets
 * `SkyBackground` treat them as an interchangeable set and cross-fade one
 * recipe into another without knowing what any individual layer does.
 */
export type LayerProps = {
  width: number;
  height: number;
  state: SkyState;
  palette: SkyPalette;
  /** Particle-count multiplier from the quality tier (0–1). */
  quality: number;
  /** When false, layers render a static frame and start no animations. */
  motion: boolean;
};

/**
 * Storm cadence, in ms.
 *
 * Lightning flashes and the screen rumble are separate components that must
 * fire together. Rather than coordinate them with JS timers — which would put
 * work back on the JS thread every few seconds — both derive their keyframes
 * from this shared period, so they stay in lockstep natively.
 */
export const STORM_PERIOD_MS = 9000;

/** Scale a particle count by quality, keeping at least one when enabled. */
export function scaleCount(base: number, quality: number) {
  if (quality <= 0) return 0;
  return Math.max(1, Math.round(base * quality));
}

/** Linear interpolation, clamped to the endpoints. */
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

/**
 * Rain/snow slant from wind speed.
 *
 * Returns the rotation to apply to a falling particle and the horizontal drift
 * that keeps its travel direction aligned with that rotation. RN's `rotate`
 * maps a downward vector (0,1) to (-sinθ, cosθ), so a positive angle leans the
 * streak down-and-left — hence the negated drift.
 */
export function windShear(windSpeed: number, height: number, maxDegrees = 26) {
  const degrees = Math.min(maxDegrees, windSpeed * 0.42);
  const radians = (degrees * Math.PI) / 180;
  return { degrees, driftX: -Math.tan(radians) * height };
}

/** Hex colour + alpha (0–1) as an `#rrggbbaa` string. */
export function withAlpha(hex: string, alpha: number) {
  const clean = hex.replace('#', '').slice(0, 6);
  const value = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${clean}${value}`;
}

function parseHex(hex: string) {
  const clean = hex.replace('#', '').slice(0, 6);
  const value = parseInt(clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** Blend two hex colours. `t` of 0 returns `a`, 1 returns `b`. */
export function mixHex(a: string, b: string, t: number) {
  const ca = parseHex(a);
  const cb = parseHex(b);
  const k = Math.min(1, Math.max(0, t));
  const channel = (x: number, y: number) =>
    Math.round(x + (y - x) * k)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(ca.r, cb.r)}${channel(ca.g, cb.g)}${channel(ca.b, cb.b)}`;
}

/**
 * Shared style for every full-bleed layer.
 *
 * `pointerEvents` lives here rather than as a prop: the prop form is deprecated
 * (react-native-web warns on it), and no sky layer is ever interactive, so
 * carrying it in the style every layer already spreads keeps it in one place.
 */
export const FILL = {
  position: 'absolute',
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
  pointerEvents: 'none',
} as const;

export type { SkyPalette, SkyState };
