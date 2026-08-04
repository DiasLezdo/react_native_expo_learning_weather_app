/**
 * Domain model.
 *
 * Everything the UI renders is described here and nowhere else. A real weather
 * API never matches this shape exactly — adapters in `weather/providers` map
 * vendor payloads onto these types, so screens never see vendor JSON.
 */

/**
 * The canonical weather vocabulary of the app. Every provider code (WMO,
 * OpenWeather, AccuWeather, …) collapses into one of these.
 */
export type WeatherCondition =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy-rain'
  | 'thunderstorm'
  | 'snow'
  | 'sleet'
  | 'hail'
  | 'haze'
  | 'wind';

/** Coarse phase of the local day. Drives palette selection alongside condition. */
export type DayPart = 'dawn' | 'day' | 'dusk' | 'night';

export type TemperatureUnit = 'c' | 'f';

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type Place = {
  /** Stable key. Also seeds the sky RNG so a city's stars never reshuffle. */
  id: string;
  name: string;
  region?: string;
  country: string;
  countryCode?: string;
  coordinates: Coordinates;
  /** IANA zone, e.g. `Europe/Lisbon`. */
  timezone: string;
  /** Offset from UTC in minutes, used to render the place's local clock. */
  utcOffsetMinutes: number;
  /**
   * Metres above sea level. Optional, but it is the difference between Ooty
   * reading 15°C and 28°C — latitude alone puts hill stations far too warm.
   */
  elevation?: number;
};

export type CurrentWeather = {
  /** Celsius. The UI converts at the edge; the model stays in one unit. */
  temperature: number;
  feelsLike: number;
  condition: WeatherCondition;
  /** Free-text summary from the provider, e.g. "Light rain showers". */
  summary: string;
  isDay: boolean;
  humidity: number;
  /** Percent, 0–100. */
  cloudCover: number;
  /** km/h. */
  windSpeed: number;
  /** Meteorological degrees: 0 = from north, 90 = from east. */
  windDirection: number;
  windGust: number;
  /** hPa. */
  pressure: number;
  /** km. */
  visibility: number;
  uvIndex: number;
  /** mm in the last hour. */
  precipitation: number;
  dewPoint: number;
  observedAt: number;
};

export type HourlyForecast = {
  /** Epoch ms. */
  time: number;
  temperature: number;
  condition: WeatherCondition;
  isDay: boolean;
  /** 0–100. */
  precipitationChance: number;
  precipitation: number;
  windSpeed: number;
  humidity: number;
  uvIndex: number;
};

export type DailyForecast = {
  /** Epoch ms at local midnight. */
  date: number;
  condition: WeatherCondition;
  temperatureMax: number;
  temperatureMin: number;
  precipitationChance: number;
  precipitation: number;
  windSpeed: number;
  uvIndexMax: number;
  sunrise: number;
  sunset: number;
  /** 0 = new moon, 0.5 = full. */
  moonPhase: number;
};

/**
 * One minute of the next hour.
 *
 * Minute-level nowcasting is what answers "do I need to wait five minutes
 * before leaving?" — the question a forecast in hours cannot. Providers that
 * offer it: Open-Meteo (`minutely_15`), OpenWeather One Call (`minutely`),
 * AccuWeather (MinuteCast). Optional, because plenty of sources have none.
 */
export type MinutelyForecast = {
  /** Epoch ms, on the minute. */
  time: number;
  /** Rate in mm/h — an intensity, not an accumulation. */
  intensity: number;
};

/**
 * Yesterday, for comparison.
 *
 * "4° warmer than yesterday" is the comparison people actually make, and it
 * needs a number no forecast endpoint returns — it comes from a historical or
 * time-machine endpoint. Optional for that reason.
 */
export type YesterdaySummary = {
  temperatureMax: number;
  temperatureMin: number;
  /** Temperature at this same clock time yesterday, which is the fair compare. */
  temperatureAtSameHour: number;
};

export type AirQuality = {
  /** European AQI scale. */
  index: number;
  category: 'good' | 'fair' | 'moderate' | 'poor' | 'very-poor';
  pm25: number;
  pm10: number;
  ozone: number;
  no2: number;
};

export type WeatherAlert = {
  id: string;
  title: string;
  severity: 'advisory' | 'watch' | 'warning' | 'emergency';
  description: string;
  startsAt: number;
  endsAt: number;
};

/** Everything one screen needs for one place, in one object. */
export type WeatherSnapshot = {
  place: Place;
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  /** Next 60 minutes, one entry per minute. Absent if unsupported. */
  minutely?: MinutelyForecast[];
  yesterday?: YesterdaySummary;
  airQuality?: AirQuality;
  alerts: WeatherAlert[];
  /** When this snapshot was produced, for staleness display. */
  fetchedAt: number;
};

/** Human-readable label for a condition. Used in headers and accessibility. */
export const CONDITION_LABEL: Record<WeatherCondition, string> = {
  clear: 'Clear',
  'partly-cloudy': 'Partly Cloudy',
  cloudy: 'Cloudy',
  overcast: 'Overcast',
  fog: 'Fog',
  drizzle: 'Drizzle',
  rain: 'Rain',
  'heavy-rain': 'Heavy Rain',
  thunderstorm: 'Thunderstorm',
  snow: 'Snow',
  sleet: 'Sleet',
  hail: 'Hail',
  haze: 'Haze',
  wind: 'Windy',
};

export const ALL_CONDITIONS = Object.keys(CONDITION_LABEL) as WeatherCondition[];
