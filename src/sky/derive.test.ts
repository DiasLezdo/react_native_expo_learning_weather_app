import { auroraPossible, getSkyRecipe, resolveDayPart } from './derive';
import type { SkyState } from './types';

/**
 * The recipe decides what the sky contains. Two shipped bugs lived here: heat
 * shimmer was gated on UV index rather than temperature, so it appeared over
 * cold, bright alpine days.
 */

const HOUR = 3_600_000;

function state(overrides: Partial<SkyState> = {}): SkyState {
  return {
    condition: 'clear',
    dayPart: 'day',
    intensity: 0.5,
    windSpeed: 10,
    temperature: 18,
    sunProgress: 0.5,
    moonPhase: 0.5,
    latitude: 40,
    seed: 1,
    ...overrides,
  };
}

describe('resolveDayPart', () => {
  const sunrise = Date.UTC(2026, 5, 15, 5);
  const sunset = Date.UTC(2026, 5, 15, 20);

  it('calls the middle of the day "day"', () => {
    expect(resolveDayPart(Date.UTC(2026, 5, 15, 12), sunrise, sunset)).toBe('day');
  });

  it('calls the small hours "night"', () => {
    expect(resolveDayPart(Date.UTC(2026, 5, 15, 2), sunrise, sunset)).toBe('night');
  });

  it('treats the window around sunrise as dawn', () => {
    expect(resolveDayPart(sunrise, sunrise, sunset)).toBe('dawn');
    expect(resolveDayPart(sunrise - 30 * 60_000, sunrise, sunset)).toBe('dawn');
  });

  it('treats the window around sunset as dusk', () => {
    expect(resolveDayPart(sunset, sunrise, sunset)).toBe('dusk');
    expect(resolveDayPart(sunset + 30 * 60_000, sunrise, sunset)).toBe('dusk');
  });

  it('is night well before sunrise and well after sunset', () => {
    expect(resolveDayPart(sunrise - 3 * HOUR, sunrise, sunset)).toBe('night');
    expect(resolveDayPart(sunset + 3 * HOUR, sunrise, sunset)).toBe('night');
  });
});

describe('heat shimmer', () => {
  it('appears on a genuinely hot clear day', () => {
    const recipe = getSkyRecipe(state({ condition: 'clear', temperature: 34 }));
    expect(recipe.layers).toContain('shimmer');
  });

  /*
   * The regression. A clear day at altitude has a very high UV index and no
   * heat haze whatsoever; gating on UV put shimmer over cold mountain skies.
   */
  it('does not appear on a cold clear day', () => {
    const recipe = getSkyRecipe(state({ condition: 'clear', temperature: 4, intensity: 0.95 }));
    expect(recipe.layers).not.toContain('shimmer');
  });

  it('never appears at night, however warm', () => {
    const recipe = getSkyRecipe(state({ condition: 'clear', temperature: 38, dayPart: 'night' }));
    expect(recipe.layers).not.toContain('shimmer');
  });
});

describe('aurora', () => {
  it('is possible on a high-latitude night', () => {
    expect(auroraPossible(state({ dayPart: 'night', latitude: 64 }))).toBe(true);
    expect(auroraPossible(state({ dayPart: 'night', latitude: -68 }))).toBe(true);
  });

  it('is impossible in daylight', () => {
    expect(auroraPossible(state({ dayPart: 'day', latitude: 64 }))).toBe(false);
  });

  it('is impossible in the tropics', () => {
    expect(auroraPossible(state({ dayPart: 'night', latitude: 13 }))).toBe(false);
  });

  it('is only drawn where the sky is thin enough to see through', () => {
    const clear = getSkyRecipe(state({ condition: 'clear', dayPart: 'night', latitude: 64 }));
    const overcast = getSkyRecipe(state({ condition: 'overcast', dayPart: 'night', latitude: 64 }));

    expect(clear.layers).toContain('aurora');
    expect(overcast.layers).not.toContain('aurora');
  });
});

describe('recipes', () => {
  it('gives day skies a sun and night skies a moon, never both', () => {
    const day = getSkyRecipe(state({ dayPart: 'day' }));
    const night = getSkyRecipe(state({ dayPart: 'night' }));

    expect(day.layers).toContain('sun');
    expect(day.layers).not.toContain('moon');
    expect(night.layers).toContain('moon');
    expect(night.layers).not.toContain('sun');
  });

  it('darkens and thickens cloud as conditions worsen', () => {
    const clear = getSkyRecipe(state({ condition: 'clear' }));
    const cloudy = getSkyRecipe(state({ condition: 'cloudy' }));
    const storm = getSkyRecipe(state({ condition: 'thunderstorm' }));

    expect(clear.cloudiness).toBeLessThan(cloudy.cloudiness);
    expect(cloudy.cloudiness).toBeLessThanOrEqual(storm.cloudiness);
    expect(clear.cloudDarkness).toBeLessThan(storm.cloudDarkness);
  });

  it('only reflects city lights on wet nights', () => {
    const wetNight = getSkyRecipe(state({ condition: 'rain', dayPart: 'night' }));
    const wetDay = getSkyRecipe(state({ condition: 'rain', dayPart: 'day' }));

    expect(wetNight.layers).toContain('cityLights');
    expect(wetDay.layers).not.toContain('cityLights');
  });

  it('gives every condition a recipe with layers and sane cloud values', () => {
    const conditions = [
      'clear',
      'partly-cloudy',
      'cloudy',
      'overcast',
      'fog',
      'drizzle',
      'rain',
      'heavy-rain',
      'thunderstorm',
      'snow',
      'sleet',
      'hail',
      'haze',
      'wind',
    ] as const;

    for (const condition of conditions) {
      for (const dayPart of ['dawn', 'day', 'dusk', 'night'] as const) {
        const recipe = getSkyRecipe(state({ condition, dayPart }));

        expect(recipe.layers.length).toBeGreaterThan(0);
        expect(recipe.cloudiness).toBeGreaterThanOrEqual(0);
        expect(recipe.cloudiness).toBeLessThanOrEqual(1);
        expect(recipe.cloudDarkness).toBeGreaterThanOrEqual(0);
        expect(recipe.cloudDarkness).toBeLessThanOrEqual(1);
      }
    }
  });
});
