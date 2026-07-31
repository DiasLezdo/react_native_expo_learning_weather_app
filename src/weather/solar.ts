/**
 * Sunrise/sunset from latitude and date.
 *
 * The sky's day/night switching has to be correct per city — 21:00 is daylight
 * in Reykjavík in June and the middle of the night in Singapore. Real providers
 * return these times; the mock computes them so both paths behave identically.
 *
 * Accurate to a few minutes, which is well inside the golden-hour window the
 * palette uses.
 */

const DAY_MS = 86_400_000;
const DEG = Math.PI / 180;

/** Start of the local day, expressed as a UTC timestamp. */
export function localMidnight(timestamp: number, utcOffsetMinutes: number) {
  const offsetMs = utcOffsetMinutes * 60_000;
  return Math.floor((timestamp + offsetMs) / DAY_MS) * DAY_MS - offsetMs;
}

/** Local hour-of-day as a float, e.g. 13.5 for 13:30. */
export function localHours(timestamp: number, utcOffsetMinutes: number) {
  return (timestamp - localMidnight(timestamp, utcOffsetMinutes)) / 3_600_000;
}

/** 1–366, in the place's local calendar. Drives seasonal temperature too. */
export function dayOfYear(timestamp: number, utcOffsetMinutes: number) {
  const local = new Date(timestamp + utcOffsetMinutes * 60_000);
  const start = Date.UTC(local.getUTCFullYear(), 0, 0);
  return (local.getTime() - start) / DAY_MS;
}

export type SunTimes = { sunrise: number; sunset: number; daylightHours: number };

export function computeSunTimes(
  timestamp: number,
  latitude: number,
  utcOffsetMinutes: number,
): SunTimes {
  const midnight = localMidnight(timestamp, utcOffsetMinutes);
  const n = dayOfYear(timestamp, utcOffsetMinutes);

  // Solar declination: the sun's tilt relative to the equator on this date.
  const declination = 23.44 * DEG * Math.sin(2 * Math.PI * ((n - 81) / 365));
  const latRad = latitude * DEG;

  // Hour angle at sunrise. Outside [-1, 1] means the sun never crosses the
  // horizon — polar day or polar night.
  const cosHourAngle = -Math.tan(latRad) * Math.tan(declination);

  if (cosHourAngle <= -1) {
    // Midnight sun: treat the whole day as daylight.
    return { sunrise: midnight, sunset: midnight + DAY_MS, daylightHours: 24 };
  }
  if (cosHourAngle >= 1) {
    // Polar night: collapse both events onto local noon so nothing is "day".
    const noon = midnight + DAY_MS / 2;
    return { sunrise: noon, sunset: noon, daylightHours: 0 };
  }

  const hourAngle = Math.acos(cosHourAngle) / DEG;
  const daylightHours = (2 * hourAngle) / 15;
  const solarNoon = midnight + DAY_MS / 2;
  const halfDayMs = (daylightHours / 2) * 3_600_000;

  return {
    sunrise: solarNoon - halfDayMs,
    sunset: solarNoon + halfDayMs,
    daylightHours,
  };
}

/** Synodic month in ms, used to advance the mock moon phase day to day. */
const LUNAR_CYCLE_MS = 29.530588853 * DAY_MS;
/** A known new moon: 2000-01-06T18:14Z. */
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

/** 0 = new moon, 0.5 = full moon, approaching 1 = waning back to new. */
export function moonPhase(timestamp: number) {
  const elapsed = (timestamp - KNOWN_NEW_MOON) % LUNAR_CYCLE_MS;
  return ((elapsed + LUNAR_CYCLE_MS) % LUNAR_CYCLE_MS) / LUNAR_CYCLE_MS;
}
