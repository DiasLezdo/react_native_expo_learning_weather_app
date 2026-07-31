import { hashSeed } from '@/lib/rng';
import type { DayPart, WeatherSnapshot } from '@/weather/types';
import type { SkyState } from './types';

/** Golden hour runs this many minutes either side of sunrise/sunset. */
const TWILIGHT_MINUTES = 55;

/**
 * Classify a moment into a day part using the day's actual sun times rather
 * than fixed clock hours — 7pm is daylight in June and night in December.
 */
export function resolveDayPart(now: number, sunrise: number, sunset: number): DayPart {
  const window = TWILIGHT_MINUTES * 60_000;

  if (now >= sunrise - window && now <= sunrise + window) return 'dawn';
  if (now >= sunset - window && now <= sunset + window) return 'dusk';
  if (now > sunrise + window && now < sunset - window) return 'day';
  return 'night';
}

/**
 * How hard the weather is happening, 0–1.
 *
 * Intensity is what separates a drizzle from a downpour visually, so it is
 * derived from the physical measurements rather than the condition label.
 */
function resolveIntensity(snapshot: WeatherSnapshot): number {
  const { current } = snapshot;

  switch (current.condition) {
    case 'drizzle':
      return clamp01(0.2 + current.precipitation / 2);
    case 'rain':
      return clamp01(0.4 + current.precipitation / 6);
    case 'heavy-rain':
      return clamp01(0.72 + current.precipitation / 14);
    case 'thunderstorm':
      return clamp01(0.78 + current.precipitation / 16);
    case 'snow':
    case 'sleet':
      return clamp01(0.32 + current.precipitation / 4);
    case 'hail':
      return clamp01(0.6 + current.precipitation / 8);
    case 'fog':
    case 'haze':
      return clamp01(1 - current.visibility / 10);
    case 'cloudy':
    case 'overcast':
    case 'partly-cloudy':
      return clamp01(current.cloudCover / 100);
    case 'wind':
      return clamp01(current.windSpeed / 70);
    case 'clear':
      return clamp01(0.25 + current.uvIndex / 16);
    default:
      return 0.5;
  }
}

export function deriveSkyState(snapshot: WeatherSnapshot, now = Date.now()): SkyState {
  const today = snapshot.daily[0];
  const dayPart = today
    ? resolveDayPart(now, today.sunrise, today.sunset)
    : snapshot.current.isDay
      ? 'day'
      : 'night';

  // Clamped so a sun rendered during twilight sits at the horizon rather than
  // sliding off screen.
  const sunProgress = today
    ? clamp01((now - today.sunrise) / Math.max(1, today.sunset - today.sunrise))
    : 0.5;

  return {
    condition: snapshot.current.condition,
    dayPart,
    intensity: resolveIntensity(snapshot),
    windSpeed: snapshot.current.windSpeed,
    temperature: snapshot.current.temperature,
    sunProgress,
    moonPhase: today?.moonPhase ?? 0.5,
    seed: hashSeed(snapshot.place.id),
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/**
 * Which animated layers make up each condition.
 *
 * Conditions are compositions, not monoliths: a thunderstorm is dark clouds +
 * heavy rain + lightning + ripples, and each of those pieces is independently
 * reusable. `SkyBackground` cross-fades between two of these recipes.
 */
export type SkyLayerName =
  | 'stars'
  | 'moon'
  | 'sun'
  | 'sunRays'
  | 'clouds'
  | 'rain'
  | 'snow'
  | 'sleet'
  | 'hail'
  | 'fog'
  | 'lightning'
  | 'shimmer'
  | 'ripples'
  | 'glassDrops'
  | 'cityLights'
  | 'frost'
  | 'gusts'
  | 'dust';

export type SkyRecipe = {
  layers: SkyLayerName[];
  /** Cloud band density 0–1, independent of precipitation intensity. */
  cloudiness: number;
  /** Cloud darkness 0–1: 0 is a fair-weather cumulus, 1 is a storm cell. */
  cloudDarkness: number;
};

export function getSkyRecipe(state: SkyState): SkyRecipe {
  const night = state.dayPart === 'night';
  const celestial: SkyLayerName[] = night ? ['stars', 'moon'] : ['sun', 'sunRays'];

  switch (state.condition) {
    case 'clear':
      return {
        // Shimmer only when it is genuinely hot. Gating this on UV — as it
        // was — put heat haze over cold, bright alpine days.
        layers: [...celestial, 'clouds', ...(!night && state.temperature >= 30 ? ['shimmer' as const] : [])],
        cloudiness: 0.12,
        cloudDarkness: 0,
      };

    case 'partly-cloudy':
      return { layers: [...celestial, 'clouds'], cloudiness: 0.45, cloudDarkness: 0.12 };

    case 'cloudy':
      return { layers: ['clouds'], cloudiness: 0.75, cloudDarkness: 0.3 };

    case 'overcast':
      return { layers: ['clouds', 'fog'], cloudiness: 1, cloudDarkness: 0.55 };

    case 'fog':
      return { layers: ['clouds', 'fog', ...(night ? ['cityLights' as const] : [])], cloudiness: 0.5, cloudDarkness: 0.25 };

    case 'haze':
      return { layers: ['clouds', 'fog', 'dust', ...(!night ? ['sun' as const, 'shimmer' as const] : [])], cloudiness: 0.35, cloudDarkness: 0.15 };

    case 'drizzle':
      return { layers: ['clouds', 'rain', 'fog', 'ripples', ...(night ? ['cityLights' as const] : [])], cloudiness: 0.8, cloudDarkness: 0.4 };

    case 'rain':
      return {
        layers: ['clouds', 'rain', 'ripples', 'glassDrops', ...(night ? ['cityLights' as const] : [])],
        cloudiness: 0.9,
        cloudDarkness: 0.55,
      };

    case 'heavy-rain':
      return {
        layers: ['clouds', 'rain', 'ripples', 'glassDrops', 'fog', ...(night ? ['cityLights' as const] : [])],
        cloudiness: 1,
        cloudDarkness: 0.75,
      };

    case 'thunderstorm':
      return {
        layers: ['clouds', 'rain', 'lightning', 'ripples', 'glassDrops', ...(night ? ['cityLights' as const] : [])],
        cloudiness: 1,
        cloudDarkness: 0.92,
      };

    case 'snow':
      return { layers: ['clouds', 'snow', 'frost', ...(night ? ['stars' as const] : [])], cloudiness: 0.7, cloudDarkness: 0.28 };

    case 'sleet':
      return { layers: ['clouds', 'sleet', 'ripples', 'frost'], cloudiness: 0.85, cloudDarkness: 0.45 };

    case 'hail':
      return { layers: ['clouds', 'hail', 'ripples', 'frost'], cloudiness: 0.95, cloudDarkness: 0.6 };

    case 'wind':
      return { layers: [...celestial, 'clouds', 'gusts'], cloudiness: 0.5, cloudDarkness: 0.2 };

    default:
      return { layers: [...celestial, 'clouds'], cloudiness: 0.3, cloudDarkness: 0.1 };
  }
}
