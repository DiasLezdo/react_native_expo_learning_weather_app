import type { Place, TemperatureUnit, WeatherCondition } from './types';

/**
 * Formatting helpers.
 *
 * All time formatting is done with plain offset arithmetic instead of
 * `Intl.DateTimeFormat({ timeZone })`. Hermes' ICU coverage varies by platform
 * and build, and a city clock that silently falls back to device-local time is
 * a bug users would never report but would always feel.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A Date shifted so its UTC getters read as the place's local wall clock. */
function asLocal(timestamp: number, utcOffsetMinutes: number) {
  return new Date(timestamp + utcOffsetMinutes * 60_000);
}

export function toFahrenheit(celsius: number) {
  return celsius * 1.8 + 32;
}

export function convertTemperature(celsius: number, unit: TemperatureUnit) {
  return unit === 'f' ? toFahrenheit(celsius) : celsius;
}

/** Rounded temperature with no unit suffix — the degree mark is drawn by the UI. */
export function formatTemperature(celsius: number, unit: TemperatureUnit) {
  return `${Math.round(convertTemperature(celsius, unit))}°`;
}

export function formatHour(timestamp: number, utcOffsetMinutes: number, use24Hour = false) {
  const d = asLocal(timestamp, utcOffsetMinutes);
  const hours = d.getUTCHours();

  if (use24Hour) return `${String(hours).padStart(2, '0')}:00`;

  const suffix = hours >= 12 ? 'PM' : 'AM';
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve} ${suffix}`;
}

export function formatClock(timestamp: number, utcOffsetMinutes: number, use24Hour = false) {
  const d = asLocal(timestamp, utcOffsetMinutes);
  const hours = d.getUTCHours();
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');

  if (use24Hour) return `${String(hours).padStart(2, '0')}:${minutes}`;

  const suffix = hours >= 12 ? 'PM' : 'AM';
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${minutes} ${suffix}`;
}

export function formatWeekday(timestamp: number, utcOffsetMinutes: number, long = false) {
  const d = asLocal(timestamp, utcOffsetMinutes);
  return (long ? WEEKDAYS_LONG : WEEKDAYS)[d.getUTCDay()];
}

export function formatDate(timestamp: number, utcOffsetMinutes: number) {
  const d = asLocal(timestamp, utcOffsetMinutes);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** True when both timestamps land on the same local calendar day. */
export function isSameLocalDay(a: number, b: number, utcOffsetMinutes: number) {
  const da = asLocal(a, utcOffsetMinutes);
  const db = asLocal(b, utcOffsetMinutes);
  return (
    da.getUTCFullYear() === db.getUTCFullYear() &&
    da.getUTCMonth() === db.getUTCMonth() &&
    da.getUTCDate() === db.getUTCDate()
  );
}

/** "Now", "in 3h", "2h ago" — relative to the same instant, timezone-free. */
export function formatRelative(timestamp: number, now = Date.now()) {
  const diffMinutes = Math.round((timestamp - now) / 60_000);
  const abs = Math.abs(diffMinutes);

  if (abs < 2) return 'Now';
  if (abs < 60) return diffMinutes > 0 ? `in ${abs}m` : `${abs}m ago`;

  const hours = Math.round(abs / 60);
  if (hours < 24) return diffMinutes > 0 ? `in ${hours}h` : `${hours}h ago`;

  const days = Math.round(hours / 24);
  return diffMinutes > 0 ? `in ${days}d` : `${days}d ago`;
}

/** 16 compass points from meteorological degrees. */
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function formatWindDirection(degrees: number) {
  return COMPASS[Math.round(degrees / 22.5) % 16];
}

export function formatPlace(place: Place) {
  return place.region ? `${place.name}, ${place.region}` : place.name;
}

export function uvCategory(uv: number) {
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very High';
  return 'Extreme';
}

export function visibilityCategory(km: number) {
  if (km < 1) return 'Very poor';
  if (km < 4) return 'Poor';
  if (km < 10) return 'Moderate';
  if (km < 20) return 'Good';
  return 'Excellent';
}

export function pressureTrendLabel(hPa: number) {
  if (hPa < 1000) return 'Low — unsettled';
  if (hPa > 1020) return 'High — settled';
  return 'Steady';
}

export function humidityLabel(humidity: number, dewPoint: number, unit: TemperatureUnit) {
  return `Dew point ${formatTemperature(dewPoint, unit)} · ${
    humidity > 80 ? 'Muggy' : humidity < 35 ? 'Dry air' : 'Comfortable'
  }`;
}

export function airQualityLabel(category: string) {
  return category.replace('-', ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * "4° warmer than yesterday", or null when the difference isn't worth saying.
 *
 * Compares like with like — this hour against the same hour yesterday, not
 * against yesterday's high, which would read as colder every single evening.
 * The threshold is in whole displayed degrees, so the line never contradicts
 * the rounded numbers on screen: a 0.6°C gap that both round to the same value
 * would otherwise claim a difference the user cannot see.
 */
export function compareToYesterday(
  currentCelsius: number,
  yesterdayCelsius: number,
  unit: TemperatureUnit,
): string | null {
  const current = Math.round(convertTemperature(currentCelsius, unit));
  const before = Math.round(convertTemperature(yesterdayCelsius, unit));
  const delta = current - before;

  if (delta === 0) return 'Same as yesterday';
  return `${Math.abs(delta)}° ${delta > 0 ? 'warmer' : 'cooler'} than yesterday`;
}

/** Short verb phrase for the hero, e.g. "Rain easing within the hour". */
export function conditionTagline(condition: WeatherCondition, precipitationChance: number) {
  const wet = precipitationChance > 45;
  switch (condition) {
    case 'thunderstorm':
      return 'Storms overhead — stay in';
    case 'heavy-rain':
      return 'Heavy rain, take cover';
    case 'rain':
      return wet ? 'Rain continuing' : 'Rain easing off';
    case 'drizzle':
      return 'Light drizzle in the air';
    case 'snow':
      return 'Snow settling';
    case 'sleet':
      return 'Wintry mix — roads slick';
    case 'hail':
      return 'Hail — shelter vehicles';
    case 'fog':
      return 'Low visibility, drive slow';
    case 'haze':
      return 'Hazy air, warm and still';
    case 'wind':
      return 'Gusty — hold on to things';
    case 'overcast':
      return 'Grey but dry';
    case 'cloudy':
      return 'Cloud holding on';
    case 'partly-cloudy':
      return 'Sun breaking through';
    case 'clear':
      return 'Clear and open';
    default:
      return '';
  }
}
