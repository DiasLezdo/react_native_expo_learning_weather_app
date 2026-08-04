import { createRng, hashSeed, range, type Rng } from '@/lib/rng';
import { DIRECTORY, matchesQuery } from './directory';
import { searchOnline } from './geocoding';
import type { WeatherProvider } from './provider';
import { computeSunTimes, dayOfYear, localHours, localMidnight, moonPhase } from './solar';
import type {
  AirQuality,
  Coordinates,
  CurrentWeather,
  DailyForecast,
  HourlyForecast,
  MinutelyForecast,
  Place,
  WeatherAlert,
  WeatherCondition,
  WeatherSnapshot,
} from './types';

/**
 * Mock weather source.
 *
 * Generates coherent, deterministic data for **any** place — temperatures
 * follow a diurnal curve anchored to that location's real sunrise, and
 * conditions persist in runs rather than flickering hour to hour.
 *
 * Fourteen featured cities carry hand-tuned profiles so every animated sky is
 * reachable from the demo data. Everywhere else derives a plausible climate
 * from latitude and season, which is what lets a city added from search work
 * exactly like a built-in one.
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Everything the generator needs to know about a location's climate. */
type Climate = {
  /** Dominant condition, from which the hourly sequence wanders. */
  signature: WeatherCondition;
  /** Mean temperature in °C for the current season. */
  baseTemp: number;
  /** Peak-to-trough diurnal swing in °C. */
  swing: number;
  humidity: number;
  wind: number;
};

type FeaturedCity = { place: Place; climate: Climate };

function featured(
  id: string,
  name: string,
  country: string,
  countryCode: string,
  latitude: number,
  longitude: number,
  timezone: string,
  utcOffsetMinutes: number,
  climate: Climate,
  region?: string,
): FeaturedCity {
  return {
    place: {
      id,
      name,
      country,
      countryCode,
      coordinates: { latitude, longitude },
      timezone,
      utcOffsetMinutes,
      region,
    },
    climate,
  };
}

/** One city per signature condition, so the Sky screen has real data behind it. */
const FEATURED: FeaturedCity[] = [
  featured('lisbon', 'Lisbon', 'Portugal', 'PT', 38.7223, -9.1393, 'Europe/Lisbon', 60, {
    signature: 'clear',
    baseTemp: 24,
    swing: 8,
    humidity: 55,
    wind: 14,
  }),
  featured('london', 'London', 'United Kingdom', 'GB', 51.5072, -0.1276, 'Europe/London', 60, {
    signature: 'rain',
    baseTemp: 13,
    swing: 6,
    humidity: 82,
    wind: 19,
  }),
  featured('singapore', 'Singapore', 'Singapore', 'SG', 1.3521, 103.8198, 'Asia/Singapore', 480, {
    signature: 'thunderstorm',
    baseTemp: 29,
    swing: 4,
    humidity: 88,
    wind: 11,
  }),
  featured('reykjavik', 'Reykjavík', 'Iceland', 'IS', 64.1466, -21.9426, 'Atlantic/Reykjavik', 0, {
    signature: 'snow',
    baseTemp: -3,
    swing: 4,
    humidity: 76,
    wind: 33,
  }),
  featured('dubai', 'Dubai', 'United Arab Emirates', 'AE', 25.2048, 55.2708, 'Asia/Dubai', 240, {
    signature: 'haze',
    baseTemp: 38,
    swing: 10,
    humidity: 38,
    wind: 16,
  }),
  featured(
    'san-francisco',
    'San Francisco',
    'United States',
    'US',
    37.7749,
    -122.4194,
    'America/Los_Angeles',
    -420,
    { signature: 'fog', baseTemp: 15, swing: 5, humidity: 84, wind: 21 },
    'California',
  ),
  featured('tokyo', 'Tokyo', 'Japan', 'JP', 35.6762, 139.6503, 'Asia/Tokyo', 540, {
    signature: 'partly-cloudy',
    baseTemp: 21,
    swing: 7,
    humidity: 64,
    wind: 13,
  }),
  featured(
    'chicago',
    'Chicago',
    'United States',
    'US',
    41.8781,
    -87.6298,
    'America/Chicago',
    -300,
    { signature: 'wind', baseTemp: 9, swing: 9, humidity: 61, wind: 46 },
    'Illinois',
  ),
  featured(
    'mumbai',
    'Mumbai',
    'India',
    'IN',
    19.076,
    72.8777,
    'Asia/Kolkata',
    330,
    { signature: 'heavy-rain', baseTemp: 28, swing: 5, humidity: 90, wind: 27 },
    'Maharashtra',
  ),
  featured('oslo', 'Oslo', 'Norway', 'NO', 59.9139, 10.7522, 'Europe/Oslo', 120, {
    signature: 'overcast',
    baseTemp: 4,
    swing: 6,
    humidity: 78,
    wind: 12,
  }),
  featured('cairo', 'Cairo', 'Egypt', 'EG', 30.0444, 31.2357, 'Africa/Cairo', 120, {
    signature: 'clear',
    baseTemp: 33,
    swing: 12,
    humidity: 30,
    wind: 18,
  }),
  featured(
    'vancouver',
    'Vancouver',
    'Canada',
    'CA',
    49.2827,
    -123.1207,
    'America/Vancouver',
    -420,
    { signature: 'drizzle', baseTemp: 11, swing: 5, humidity: 85, wind: 15 },
    'British Columbia',
  ),
  featured(
    'denver',
    'Denver',
    'United States',
    'US',
    39.7392,
    -104.9903,
    'America/Denver',
    -360,
    { signature: 'hail', baseTemp: 12, swing: 13, humidity: 44, wind: 24 },
    'Colorado',
  ),
  featured('helsinki', 'Helsinki', 'Finland', 'FI', 60.1699, 24.9384, 'Europe/Helsinki', 180, {
    signature: 'sleet',
    baseTemp: 1,
    swing: 4,
    humidity: 80,
    wind: 20,
  }),
];

const FEATURED_BY_ID = new Map(FEATURED.map((city) => [city.place.id, city]));

/** Featured cities first, then the bundled directory, deduplicated by name. */
const SEARCHABLE: Place[] = (() => {
  const seen = new Set<string>();
  const out: Place[] = [];

  for (const place of [...FEATURED.map((c) => c.place), ...DIRECTORY]) {
    const key = `${place.name}|${place.country}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(place);
  }
  return out;
})();

/**
 * Plausible climate for a place with no hand-tuned profile.
 *
 * Latitude sets the annual mean and the size of the seasonal swing; hemisphere
 * sets its phase, so July is summer in Chennai and winter in Melbourne. It is
 * not a climate model — it just has to be believable and stable.
 */
function deriveClimate(place: Place, now: number): Climate {
  const rng = createRng(hashSeed(place.id));
  const { latitude } = place.coordinates;
  const absLatitude = Math.abs(latitude);

  /*
   * Annual mean by latitude.
   *
   * Not linear: real temperature is nearly flat across the tropics and then
   * falls away sharply. This curve was fitted against actual annual means and
   * lands within ~2°C at Chennai, Tokyo, New York, London and Oslo, where a
   * straight line was 10°C too warm at the poles and too cool at 50°.
   */
  const annualMean = -8 + 36 * Math.pow(Math.cos((absLatitude * Math.PI) / 180), 1.5);

  // Seasonal swing is negligible in the tropics, dominant at high latitude.
  const seasonalAmplitude = absLatitude * 0.24;
  const n = dayOfYear(now, place.utcOffsetMinutes);
  // Peaks near the June solstice in the north, December in the south.
  const seasonalPhase = Math.sin((2 * Math.PI * (n - 81)) / 365) * (latitude >= 0 ? 1 : -1);

  /*
   * Elevation. Air cools with height at roughly 6.5°C/km, but applying the full
   * rate to a sea-level baseline overshoots on sunlit plateaus, so 5.5 is used
   * and the total is capped. Without any of this, Ooty and Darjeeling report
   * lowland temperatures ~12°C too warm; without the cap, Leh at 3500m comes
   * out near freezing in midsummer.
   *
   * Known limitation: continentality isn't modelled, so hot inland plains such
   * as Delhi read a few degrees cool. Mock data — the real provider replaces
   * all of this.
   */
  const MAX_LAPSE = 14;
  const lapse = Math.min(MAX_LAPSE, ((place.elevation ?? 0) / 1000) * 5.5);

  const baseTemp = annualMean + seasonalAmplitude * seasonalPhase - lapse + range(rng, -2, 2);

  const swing = 5 + absLatitude * 0.09 + range(rng, 0, 4);
  const humidity = Math.round(
    Math.min(95, Math.max(22, 78 - absLatitude * 0.25 + range(rng, -14, 14))),
  );
  const wind = range(rng, 6, 30);

  return {
    signature: deriveSignature(rng, absLatitude, humidity, baseTemp),
    baseTemp,
    swing,
    humidity,
    wind,
  };
}

function deriveSignature(rng: Rng, absLatitude: number, humidity: number, baseTemp: number) {
  if (baseTemp < 1) return pick(rng, ['snow', 'overcast', 'cloudy', 'sleet'] as const);

  // Tropics: humid means convective storms, dry means haze and glare.
  if (absLatitude < 23.5) {
    return humidity > 68
      ? pick(rng, ['thunderstorm', 'heavy-rain', 'rain', 'partly-cloudy', 'clear'] as const)
      : pick(rng, ['clear', 'haze', 'partly-cloudy'] as const);
  }
  if (absLatitude < 45) {
    return pick(rng, ['clear', 'partly-cloudy', 'cloudy', 'rain', 'wind'] as const);
  }
  return pick(rng, ['overcast', 'cloudy', 'rain', 'drizzle', 'fog'] as const);
}

function climateFor(place: Place, now: number): Climate {
  return FEATURED_BY_ID.get(place.id)?.climate ?? deriveClimate(place, now);
}

/** Conditions the generator can drift into from a signature. */
const NEIGHBOURS: Record<WeatherCondition, WeatherCondition[]> = {
  clear: ['clear', 'clear', 'partly-cloudy', 'haze'],
  'partly-cloudy': ['partly-cloudy', 'clear', 'cloudy'],
  cloudy: ['cloudy', 'partly-cloudy', 'overcast'],
  overcast: ['overcast', 'cloudy', 'drizzle'],
  fog: ['fog', 'overcast', 'cloudy'],
  drizzle: ['drizzle', 'rain', 'overcast'],
  rain: ['rain', 'drizzle', 'heavy-rain', 'overcast'],
  'heavy-rain': ['heavy-rain', 'rain', 'thunderstorm'],
  thunderstorm: ['thunderstorm', 'heavy-rain', 'rain'],
  snow: ['snow', 'sleet', 'overcast'],
  sleet: ['sleet', 'snow', 'rain'],
  hail: ['hail', 'thunderstorm', 'rain'],
  haze: ['haze', 'clear', 'partly-cloudy'],
  wind: ['wind', 'partly-cloudy', 'cloudy'],
};

/** Physical characteristics of each condition, keeping the numbers coherent. */
const PROFILE: Record<WeatherCondition, { cloud: number; precip: number; visibility: number; uvFactor: number }> = {
  clear: { cloud: 6, precip: 0, visibility: 24, uvFactor: 1 },
  'partly-cloudy': { cloud: 38, precip: 0, visibility: 20, uvFactor: 0.82 },
  cloudy: { cloud: 68, precip: 0, visibility: 16, uvFactor: 0.55 },
  overcast: { cloud: 95, precip: 0.1, visibility: 12, uvFactor: 0.3 },
  fog: { cloud: 80, precip: 0.1, visibility: 1.1, uvFactor: 0.25 },
  drizzle: { cloud: 88, precip: 0.6, visibility: 8, uvFactor: 0.24 },
  rain: { cloud: 94, precip: 3.2, visibility: 6, uvFactor: 0.18 },
  'heavy-rain': { cloud: 99, precip: 9.5, visibility: 3, uvFactor: 0.12 },
  thunderstorm: { cloud: 100, precip: 13, visibility: 2.4, uvFactor: 0.1 },
  snow: { cloud: 90, precip: 2.4, visibility: 3.5, uvFactor: 0.4 },
  sleet: { cloud: 92, precip: 2.8, visibility: 4, uvFactor: 0.2 },
  hail: { cloud: 97, precip: 6, visibility: 3.2, uvFactor: 0.16 },
  haze: { cloud: 30, precip: 0, visibility: 4.5, uvFactor: 0.7 },
  wind: { cloud: 45, precip: 0, visibility: 18, uvFactor: 0.8 },
};

const SUMMARY: Record<WeatherCondition, string[]> = {
  clear: ['Clear skies', 'Not a cloud in sight', 'Bright and open'],
  'partly-cloudy': ['Sun between clouds', 'Broken cloud', 'Mostly bright'],
  cloudy: ['Cloud cover building', 'Grey and settled', 'Thick cloud'],
  overcast: ['Low, heavy cloud', 'Flat grey sky', 'Overcast all day'],
  fog: ['Dense fog', 'Visibility down to nothing', 'Fog holding in'],
  drizzle: ['Fine drizzle', 'Damp and misting', 'Light spitting rain'],
  rain: ['Steady rain', 'Rain setting in', 'Persistent showers'],
  'heavy-rain': ['Heavy rain', 'Torrential downpour', 'Rain coming down hard'],
  thunderstorm: ['Thunderstorms overhead', 'Electrical storm', 'Thunder and heavy rain'],
  snow: ['Snow falling', 'Steady snowfall', 'Soft, settling snow'],
  sleet: ['Sleet and wintry mix', 'Freezing rain', 'Sleet turning to snow'],
  hail: ['Hail showers', 'Hailstones falling', 'Sharp hail bursts'],
  haze: ['Heat haze', 'Dust in the air', 'Hazy and still'],
  wind: ['Strong gusts', 'Blustery', 'Wind picking up'],
};

/**
 * Diurnal temperature curve. Coldest just before sunrise, warmest ~3h after
 * solar noon — a shifted cosine reproduces that shape closely enough.
 */
function diurnalOffset(hour: number, sunriseHour: number, swing: number) {
  const peak = (sunriseHour + 9) % 24;
  const phase = ((hour - peak + 24) % 24) / 24;
  return (Math.cos(phase * 2 * Math.PI) * swing) / 2;
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

function round(value: number, places = 0) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/** Run-length sequence, so weather persists for hours instead of flickering. */
function conditionRuns(rng: Rng, signature: WeatherCondition, length: number): WeatherCondition[] {
  const out: WeatherCondition[] = [];
  let current = signature;

  while (out.length < length) {
    const runLength = Math.floor(range(rng, 3, 9));
    for (let i = 0; i < runLength && out.length < length; i++) out.push(current);
    current = pick(rng, NEIGHBOURS[current] ?? [signature]);
  }
  return out;
}

function buildAirQuality(rng: Rng, condition: WeatherCondition): AirQuality {
  const dirty = condition === 'haze' ? 45 : condition === 'fog' ? 22 : 0;
  const index = Math.round(range(rng, 8, 46) + dirty);
  const category: AirQuality['category'] =
    index <= 20 ? 'good' : index <= 40 ? 'fair' : index <= 60 ? 'moderate' : index <= 80 ? 'poor' : 'very-poor';

  return {
    index,
    category,
    pm25: round(index * range(rng, 0.3, 0.6), 1),
    pm10: round(index * range(rng, 0.6, 1.1), 1),
    ozone: round(range(rng, 30, 90), 1),
    no2: round(range(rng, 4, 30), 1),
  };
}

function buildAlerts(rng: Rng, condition: WeatherCondition, now: number): WeatherAlert[] {
  const templates: Partial<Record<WeatherCondition, Omit<WeatherAlert, 'id' | 'startsAt' | 'endsAt'>>> = {
    thunderstorm: {
      title: 'Severe Thunderstorm Warning',
      severity: 'warning',
      description: 'Frequent lightning and damaging gusts expected. Stay indoors and away from windows.',
    },
    'heavy-rain': {
      title: 'Flood Watch',
      severity: 'watch',
      description: 'Persistent heavy rain may cause surface water flooding on low-lying roads.',
    },
    snow: {
      title: 'Snow and Ice Advisory',
      severity: 'advisory',
      description: 'Accumulating snow with icy patches forming after dark. Travel may be disrupted.',
    },
    hail: {
      title: 'Hail Warning',
      severity: 'warning',
      description: 'Large hail possible. Move vehicles under cover where you can.',
    },
    wind: {
      title: 'Wind Advisory',
      severity: 'advisory',
      description: 'Gusts to 70 km/h. Secure loose outdoor objects.',
    },
    haze: {
      title: 'Air Quality Advisory',
      severity: 'advisory',
      description: 'Elevated particulates. Sensitive groups should limit prolonged outdoor exertion.',
    },
  };

  const template = templates[condition];
  if (!template) return [];

  return [
    {
      ...template,
      id: `${condition}-alert`,
      startsAt: now - range(rng, 1, 4) * HOUR_MS,
      endsAt: now + range(rng, 4, 12) * HOUR_MS,
    },
  ];
}

function buildSnapshot(place: Place, now: number): WeatherSnapshot {
  const climate = climateFor(place, now);
  // Reseeding per day keeps a place's forecast stable within a session but
  // lets it evolve across days.
  const rng = createRng(hashSeed(place.id) ^ Math.floor(now / DAY_MS));

  const { latitude } = place.coordinates;
  const offset = place.utcOffsetMinutes;

  const HOURS = 48;
  const DAYS = 10;

  const startOfHour = Math.floor(now / HOUR_MS) * HOUR_MS;
  const conditions = conditionRuns(rng, climate.signature, HOURS);

  const hourly: HourlyForecast[] = [];
  for (let i = 0; i < HOURS; i++) {
    const time = startOfHour + i * HOUR_MS;
    const sun = computeSunTimes(time, latitude, offset);
    const hour = localHours(time, offset);
    const sunriseHour = localHours(sun.sunrise, offset);
    const isDay = time >= sun.sunrise && time <= sun.sunset;

    const condition = conditions[i];
    const profile = PROFILE[condition];
    const temperature =
      climate.baseTemp + diurnalOffset(hour, sunriseHour, climate.swing) + range(rng, -1.2, 1.2);

    // UV tracks the sun's height: peaks at solar noon, zero at night.
    const solarAltitude = Math.max(
      0,
      Math.sin(((hour - sunriseHour) / Math.max(sun.daylightHours, 1)) * Math.PI),
    );
    const uvIndex = isDay ? round(solarAltitude * 11 * profile.uvFactor, 1) : 0;

    hourly.push({
      time,
      temperature: round(temperature, 1),
      condition,
      isDay,
      precipitationChance: Math.round(Math.min(100, profile.precip * 9 + range(rng, 0, 14))),
      precipitation: round(profile.precip * range(rng, 0.55, 1.45), 1),
      windSpeed: round(climate.wind * range(rng, 0.65, 1.35), 1),
      humidity: Math.round(Math.min(100, climate.humidity + range(rng, -9, 9))),
      uvIndex,
    });
  }

  const daily: DailyForecast[] = [];
  for (let d = 0; d < DAYS; d++) {
    const date = localMidnight(now + d * DAY_MS, offset);
    const sun = computeSunTimes(date + DAY_MS / 2, latitude, offset);
    // Days 0 and 1 reuse the hourly run so the two views never disagree.
    const slice = hourly.slice(d * 24, d * 24 + 24);
    const condition = slice.length ? mode(slice.map((h) => h.condition)) : pick(rng, NEIGHBOURS[climate.signature]);
    const profile = PROFILE[condition];

    const drift = range(rng, -3, 3) + d * range(rng, -0.35, 0.35);
    const temps = slice.length
      ? slice.map((h) => h.temperature)
      : [climate.baseTemp + drift - climate.swing / 2, climate.baseTemp + drift + climate.swing / 2];

    daily.push({
      date,
      condition,
      temperatureMax: round(Math.max(...temps), 1),
      temperatureMin: round(Math.min(...temps), 1),
      precipitationChance: Math.round(Math.min(100, profile.precip * 9 + range(rng, 0, 18))),
      precipitation: round(profile.precip * range(rng, 3, 9), 1),
      windSpeed: round(climate.wind * range(rng, 0.7, 1.3), 1),
      uvIndexMax: round(11 * profile.uvFactor * range(rng, 0.75, 1), 1),
      sunrise: sun.sunrise,
      sunset: sun.sunset,
      moonPhase: moonPhase(date),
    });
  }

  const nowHour = hourly[0];
  const profile = PROFILE[nowHour.condition];
  const humidity = nowHour.humidity;

  // Magnus formula — dew point from temperature and relative humidity.
  const gamma =
    (17.27 * nowHour.temperature) / (237.7 + nowHour.temperature) + Math.log(Math.max(humidity, 1) / 100);
  const dewPoint = (237.7 * gamma) / (17.27 - gamma);

  const current: CurrentWeather = {
    temperature: nowHour.temperature,
    feelsLike: round(nowHour.temperature - nowHour.windSpeed * 0.06 + (humidity - 50) * 0.03, 1),
    condition: nowHour.condition,
    summary: pick(rng, SUMMARY[nowHour.condition]),
    isDay: nowHour.isDay,
    humidity,
    cloudCover: Math.round(Math.min(100, profile.cloud + range(rng, -8, 8))),
    windSpeed: nowHour.windSpeed,
    windDirection: Math.round(range(rng, 0, 360)),
    windGust: round(nowHour.windSpeed * range(rng, 1.25, 1.8), 1),
    pressure: Math.round(range(rng, 995, 1027)),
    visibility: round(profile.visibility * range(rng, 0.85, 1.15), 1),
    uvIndex: nowHour.uvIndex,
    precipitation: nowHour.precipitation,
    dewPoint: round(dewPoint, 1),
    observedAt: now,
  };

  /*
   * Yesterday, from the same climate model run a day earlier. A real adapter
   * gets this from a historical endpoint; the shape is what matters.
   */
  const yesterdayClimate = climateFor(place, now - DAY_MS);
  const yesterdayHour = localHours(now - DAY_MS, offset);
  const yesterdaySun = computeSunTimes(now - DAY_MS, latitude, offset);
  const yesterdaySunriseHour = localHours(yesterdaySun.sunrise, offset);
  const yesterdayMean = yesterdayClimate.baseTemp;

  const yesterday = {
    temperatureMax: round(yesterdayMean + yesterdayClimate.swing / 2, 1),
    temperatureMin: round(yesterdayMean - yesterdayClimate.swing / 2, 1),
    temperatureAtSameHour: round(
      yesterdayMean + diurnalOffset(yesterdayHour, yesterdaySunriseHour, yesterdayClimate.swing),
      1,
    ),
  };

  return {
    place,
    current,
    hourly,
    daily,
    minutely: buildMinutely(rng, current.condition, Math.floor(now / 60_000) * 60_000),
    yesterday,
    airQuality: buildAirQuality(rng, current.condition),
    alerts: buildAlerts(rng, current.condition, now),
    fetchedAt: now,
  };
}

/**
 * Sixty minutes of precipitation for the hour ahead.
 *
 * Shaped as a single event with a rise and a decay rather than random noise,
 * because that is how a shower actually behaves and it is what makes
 * "stopping in 12 minutes" mean something. The phase is seeded per hour, so a
 * given hour always tells the same story.
 */
function buildMinutely(
  rng: Rng,
  condition: WeatherCondition,
  startOfMinute: number,
): MinutelyForecast[] {
  const profile = PROFILE[condition];
  const minutes: MinutelyForecast[] = [];

  if (profile.precip <= 0) {
    for (let i = 0; i < 60; i++) minutes.push({ time: startOfMinute + i * 60_000, intensity: 0 });
    return minutes;
  }

  // Where in its life cycle the event currently is: <0 hasn't begun, >60 has
  // already finished.
  const onset = range(rng, -35, 30);
  const duration = range(rng, 18, 70);
  const peak = profile.precip * range(rng, 0.7, 1.4);

  for (let i = 0; i < 60; i++) {
    const t = (i - onset) / duration;
    let intensity = 0;

    if (t > 0 && t < 1) {
      // Asymmetric bell: builds faster than it clears, like a real shower.
      const shape = t < 0.35 ? t / 0.35 : 1 - (t - 0.35) / 0.65;
      intensity = peak * Math.max(0, shape) ** 1.4;
      // Light texture, never enough to punch through the wet threshold on its
      // own — the summary must not see phantom starts and stops.
      intensity *= range(rng, 0.85, 1.15);
    }

    minutes.push({ time: startOfMinute + i * 60_000, intensity: round(Math.max(0, intensity), 2) });
  }

  return minutes;
}

/** Most frequent value, used to summarise a day from its hours. */
function mode(values: WeatherCondition[]): WeatherCondition {
  const counts = new Map<WeatherCondition, number>();
  let best = values[0];
  let bestCount = 0;

  for (const value of values) {
    const next = (counts.get(value) ?? 0) + 1;
    counts.set(value, next);
    if (next > bestCount) {
      best = value;
      bestCount = next;
    }
  }
  return best;
}

/** Simulated latency so loading states get exercised in development. */
function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export const mockProvider: WeatherProvider = {
  id: 'mock',
  label: 'Mock data',

  async searchPlaces(query, signal) {
    const trimmed = query.trim();
    if (!trimmed) return SEARCHABLE.slice(0, 10);

    const local = SEARCHABLE.filter((place) => matchesQuery(place, trimmed));

    // Online geocoding covers everything the bundled list doesn't. It resolves
    // to [] on any failure, so search still works fully offline.
    const remote = await searchOnline(trimmed, signal);

    const seen = new Set(local.map((p) => `${p.name}|${p.country}`.toLowerCase()));
    const merged = [...local];

    for (const place of remote) {
      const key = `${place.name}|${place.country}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(place);
    }

    return merged.slice(0, 20);
  },

  async reverseGeocode(coordinates: Coordinates) {
    await delay(160);
    // Nearest known place by squared distance.
    let nearest = SEARCHABLE[0];
    let bestDistance = Infinity;

    for (const place of SEARCHABLE) {
      const dLat = place.coordinates.latitude - coordinates.latitude;
      const dLon = place.coordinates.longitude - coordinates.longitude;
      const distance = dLat * dLat + dLon * dLon;
      if (distance < bestDistance) {
        bestDistance = distance;
        nearest = place;
      }
    }
    return nearest;
  },

  async getSnapshot(place) {
    await delay(280);
    // Works for any place, including one that came back from online geocoding.
    return buildSnapshot(place, Date.now());
  },
};

/** Cities shown before the user adds their own. */
export const DEFAULT_PLACES: Place[] = [
  FEATURED[0].place,
  FEATURED[1].place,
  FEATURED[2].place,
  FEATURED[3].place,
  FEATURED[5].place,
];

/**
 * Snapshot for an arbitrary condition, used by the Sky screen to preview a
 * state that isn't happening anywhere right now.
 */
export function previewSnapshot(condition: WeatherCondition, now = Date.now()): WeatherSnapshot {
  const city = FEATURED.find((c) => c.climate.signature === condition) ?? FEATURED[0];
  const snapshot = buildSnapshot(city.place, now);
  return { ...snapshot, current: { ...snapshot.current, condition } };
}
