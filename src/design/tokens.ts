import { Platform } from 'react-native';

/**
 * Design tokens for the "Aurora" surface language.
 *
 * The sky is always moving behind the content, so every foreground surface is
 * translucent and borrowed from it rather than painted over it. Nothing here is
 * opaque except type.
 *
 * A deliberate omission: no live blur. A real `BlurView` over a continuously
 * animating background forces a full re-blur every frame, which is the single
 * most expensive thing this app could do. Layered translucency plus a hairline
 * highlight reads as glass at a fraction of the cost.
 */

export const Space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Radius = {
  sm: 12,
  md: 18,
  lg: 26,
  xl: 34,
  pill: 999,
} as const;

export const Glass = {
  /** Panel fill. */
  fill: 'rgba(255,255,255,0.10)',
  fillStrong: 'rgba(255,255,255,0.16)',
  fillSubtle: 'rgba(255,255,255,0.06)',
  /** Hairline edge that catches the "light". */
  border: 'rgba(255,255,255,0.18)',
  borderStrong: 'rgba(255,255,255,0.28)',
  /** Top-edge sheen, applied as a gradient. */
  sheen: ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.02)'] as const,
} as const;

export const Ink = {
  primary: '#FFFFFF',
  secondary: 'rgba(255,255,255,0.72)',
  tertiary: 'rgba(255,255,255,0.52)',
  quaternary: 'rgba(255,255,255,0.34)',
} as const;

/** Temperature ramp, cold to hot. Used by range bars and the hourly curve. */
export const TempRamp = [
  { stop: -25, color: '#7C6BFF' },
  { stop: -10, color: '#4C8DFF' },
  { stop: 0, color: '#39B6F0' },
  { stop: 10, color: '#3FD6C4' },
  { stop: 18, color: '#8BE06B' },
  { stop: 24, color: '#FFD152' },
  { stop: 30, color: '#FF9A3D' },
  { stop: 38, color: '#FF5E4D' },
  { stop: 46, color: '#E03A6B' },
] as const;

/** Colour for a temperature in °C, interpolated along `TempRamp`. */
export function temperatureColor(celsius: number) {
  const ramp = TempRamp;
  if (celsius <= ramp[0].stop) return ramp[0].color;
  if (celsius >= ramp[ramp.length - 1].stop) return ramp[ramp.length - 1].color;

  for (let i = 0; i < ramp.length - 1; i++) {
    const a = ramp[i];
    const b = ramp[i + 1];
    if (celsius >= a.stop && celsius <= b.stop) {
      const t = (celsius - a.stop) / (b.stop - a.stop);
      return mix(a.color, b.color, t);
    }
  }
  return ramp[ramp.length - 1].color;
}

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) => {
    const va = (pa >> shift) & 255;
    const vb = (pb >> shift) & 255;
    return Math.round(va + (vb - va) * t)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/**
 * Type scale. The hero temperature is deliberately hairline-weight and huge —
 * it is the only element allowed to be that loud.
 */
export const Type = {
  hero: { fontSize: 116, fontWeight: '200' as const, letterSpacing: -6 },
  display: { fontSize: 56, fontWeight: '300' as const, letterSpacing: -2 },
  title: { fontSize: 28, fontWeight: '600' as const, letterSpacing: -0.4 },
  heading: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, fontWeight: '500' as const },
  bodySmall: { fontSize: 14, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '600' as const },
  /** Tracked micro-caps used for every section header and tile label. */
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.4 },
} as const;

export const Fonts = Platform.select({
  ios: { rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { rounded: undefined as string | undefined, mono: 'monospace' },
  web: { rounded: 'var(--font-rounded)', mono: 'var(--font-mono)' },
});

/** Height reserved for the floating tab dock, so scroll views can clear it. */
export const DOCK_HEIGHT = 68;
export const DOCK_MARGIN = 18;
