import {
  conditionFromOpenWeatherId,
  conditionFromText,
  conditionFromWmoCode,
} from './condition-codes';
import { ALL_CONDITIONS } from './types';

/**
 * These tables are the first thing a new provider adapter touches, and a wrong
 * entry is invisible in code review — it just means the sky renders the wrong
 * weather on some days.
 */

describe('conditionFromWmoCode', () => {
  it('maps the codes an adapter meets most often', () => {
    expect(conditionFromWmoCode(0)).toBe('clear');
    expect(conditionFromWmoCode(2)).toBe('partly-cloudy');
    expect(conditionFromWmoCode(3)).toBe('overcast');
    expect(conditionFromWmoCode(45)).toBe('fog');
    expect(conditionFromWmoCode(51)).toBe('drizzle');
    expect(conditionFromWmoCode(61)).toBe('rain');
    expect(conditionFromWmoCode(65)).toBe('heavy-rain');
    expect(conditionFromWmoCode(71)).toBe('snow');
    expect(conditionFromWmoCode(95)).toBe('thunderstorm');
  });

  it('falls back rather than throwing on an unknown code', () => {
    expect(ALL_CONDITIONS).toContain(conditionFromWmoCode(-1));
    expect(ALL_CONDITIONS).toContain(conditionFromWmoCode(9999));
  });

  it('always returns a condition the renderer knows how to draw', () => {
    for (let code = 0; code <= 99; code++) {
      expect(ALL_CONDITIONS).toContain(conditionFromWmoCode(code));
    }
  });
});

describe('conditionFromOpenWeatherId', () => {
  it('maps each group by its leading digit', () => {
    expect(conditionFromOpenWeatherId(200)).toBe('thunderstorm');
    expect(conditionFromOpenWeatherId(301)).toBe('drizzle');
    expect(conditionFromOpenWeatherId(500)).toBe('rain');
    expect(conditionFromOpenWeatherId(600)).toBe('snow');
    expect(conditionFromOpenWeatherId(800)).toBe('clear');
    expect(conditionFromOpenWeatherId(804)).toBe('overcast');
  });

  it('picks out the exceptions inside those groups', () => {
    expect(conditionFromOpenWeatherId(502)).toBe('heavy-rain');
    expect(conditionFromOpenWeatherId(511)).toBe('sleet');
    expect(conditionFromOpenWeatherId(611)).toBe('sleet');
    expect(conditionFromOpenWeatherId(701)).toBe('fog');
    expect(conditionFromOpenWeatherId(721)).toBe('haze');
  });

  it('distinguishes the cloud-cover steps', () => {
    expect(conditionFromOpenWeatherId(801)).toBe('partly-cloudy');
    expect(conditionFromOpenWeatherId(803)).toBe('cloudy');
  });

  it('always returns a condition the renderer knows how to draw', () => {
    for (const id of [0, 199, 250, 399, 450, 699, 799, 805, 1000]) {
      expect(ALL_CONDITIONS).toContain(conditionFromOpenWeatherId(id));
    }
  });
});

describe('conditionFromText', () => {
  it('is case-insensitive', () => {
    expect(conditionFromText('HEAVY RAIN')).toBe('heavy-rain');
    expect(conditionFromText('Clear')).toBe('clear');
  });

  /*
   * Order matters in the rule list: "heavy rain" contains "rain", and
   * "light rain" is drizzle rather than rain. The specific phrases have to be
   * tested before the general ones.
   */
  it('prefers the more specific phrase', () => {
    expect(conditionFromText('heavy rain')).toBe('heavy-rain');
    expect(conditionFromText('light rain')).toBe('drizzle');
    expect(conditionFromText('freezing rain')).toBe('sleet');
    expect(conditionFromText('thunderstorm with heavy rain')).toBe('thunderstorm');
  });

  it('reads prose a vendor might actually return', () => {
    expect(conditionFromText('Partly cloudy with a chance of showers')).toBe('rain');
    expect(conditionFromText('Patchy fog in the morning')).toBe('fog');
    expect(conditionFromText('Blowing snow')).toBe('snow');
    expect(conditionFromText('Sunny intervals')).toBe('clear');
  });

  it('falls back rather than throwing on unrecognised text', () => {
    expect(ALL_CONDITIONS).toContain(conditionFromText(''));
    expect(ALL_CONDITIONS).toContain(conditionFromText('unintelligible vendor string'));
  });
});
