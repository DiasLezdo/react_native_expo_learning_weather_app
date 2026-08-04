import type { DayPart, WeatherCondition } from '@/weather/types';

/**
 * The complete description of what the animated background should render.
 *
 * Deliberately decoupled from `WeatherSnapshot`: the Sky screen drives this
 * directly to preview conditions that aren't currently happening anywhere.
 */
export type SkyState = {
  condition: WeatherCondition;
  dayPart: DayPart;
  /**
   * 0–1. Scales particle counts, cloud opacity, wind shear. Derived from
   * precipitation rate / cloud cover so "rain" can be a drizzle or a downpour.
   */
  intensity: number;
  /** km/h. Slants rain and speeds up cloud drift. */
  windSpeed: number;
  /**
   * °C. Heat shimmer is a *temperature* phenomenon, so it needs the actual
   * temperature — a clear mountain day has a high UV index and no shimmer
   * whatsoever.
   */
  temperature: number;
  /**
   * Sun's progress across the sky: 0 at sunrise, 1 at sunset. Positions the
   * sun on its arc, so midday sits high and golden hour sits near the horizon.
   */
  sunProgress: number;
  /** 0 = new moon, 0.5 = full. Shapes the moon's terminator at night. */
  moonPhase: number;
  /**
   * Signed latitude. Aurora is the only layer that needs it — the phenomenon
   * is confined to high latitudes, and drawing curtains over Chennai would be
   * pure fantasy.
   */
  latitude: number;
  /** Seeds every particle field so a given place always renders the same sky. */
  seed: number;
};

export type SkyPalette = {
  /** Top-to-bottom gradient stops for the base sky. */
  colors: readonly [string, string, ...string[]];
  locations?: readonly [number, number, ...number[]];
  /** Highlight colour for rings, active states, and glows. */
  accent: string;
  /** Base tint for precipitation particles. */
  particle: string;
  /** Cloud body colour for this state. */
  cloud: string;
  /** How much dark scrim the foreground text needs over this sky (0–1). */
  scrim: number;
};

/** Quality tier — lets the app shed particles on low-end devices. */
export type SkyQuality = 'high' | 'balanced' | 'battery';

export const QUALITY_SCALE: Record<SkyQuality, number> = {
  high: 1,
  balanced: 0.62,
  battery: 0.3,
};
