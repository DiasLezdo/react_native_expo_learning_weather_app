import type { WeatherCondition } from './types';

/**
 * Vendor code -> app condition.
 *
 * Mapping tables live here so a new adapter never has to re-derive them. These
 * cover the two most common schemes; add a table per vendor as needed.
 */

/** WMO 4677 weather codes (Open-Meteo, DWD, most national services). */
const WMO_CODES: Record<number, WeatherCondition> = {
  0: 'clear',
  1: 'clear',
  2: 'partly-cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'fog',
  51: 'drizzle',
  53: 'drizzle',
  55: 'drizzle',
  56: 'sleet',
  57: 'sleet',
  61: 'rain',
  63: 'rain',
  65: 'heavy-rain',
  66: 'sleet',
  67: 'sleet',
  71: 'snow',
  73: 'snow',
  75: 'snow',
  77: 'snow',
  80: 'rain',
  81: 'rain',
  82: 'heavy-rain',
  85: 'snow',
  86: 'snow',
  95: 'thunderstorm',
  96: 'thunderstorm',
  99: 'thunderstorm',
};

export function conditionFromWmoCode(code: number): WeatherCondition {
  return WMO_CODES[code] ?? 'partly-cloudy';
}

/** OpenWeatherMap condition IDs, which are grouped by leading digit. */
export function conditionFromOpenWeatherId(id: number): WeatherCondition {
  if (id >= 200 && id < 300) return 'thunderstorm';
  if (id >= 300 && id < 400) return 'drizzle';
  if (id >= 500 && id < 600) {
    if (id === 502 || id === 503 || id === 504) return 'heavy-rain';
    if (id === 511) return 'sleet';
    return 'rain';
  }
  if (id >= 600 && id < 700) {
    if (id >= 611 && id <= 616) return 'sleet';
    return 'snow';
  }
  if (id >= 700 && id < 800) {
    if (id === 701 || id === 741) return 'fog';
    return 'haze';
  }
  if (id === 800) return 'clear';
  if (id === 801 || id === 802) return 'partly-cloudy';
  if (id === 803) return 'cloudy';
  if (id === 804) return 'overcast';
  return 'partly-cloudy';
}

/**
 * Last-resort classifier for vendors that only return prose. Ordered so that
 * the most specific phrases win — "heavy rain" must be tested before "rain".
 */
export function conditionFromText(text: string): WeatherCondition {
  const t = text.toLowerCase();
  const rules: [RegExp, WeatherCondition][] = [
    [/thunder|storm|lightning/, 'thunderstorm'],
    [/heavy rain|downpour|torrential/, 'heavy-rain'],
    [/freezing rain|sleet|wintry mix/, 'sleet'],
    [/hail/, 'hail'],
    [/snow|blizzard|flurr/, 'snow'],
    [/drizzle|light rain/, 'drizzle'],
    [/rain|shower/, 'rain'],
    [/fog|mist/, 'fog'],
    [/haze|smoke|dust|sand/, 'haze'],
    [/overcast/, 'overcast'],
    [/cloud/, 'cloudy'],
    [/wind|gale|breez/, 'wind'],
    [/clear|sun|fair/, 'clear'],
  ];

  for (const [pattern, condition] of rules) {
    if (pattern.test(t)) return condition;
  }
  return 'partly-cloudy';
}
