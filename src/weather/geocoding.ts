import type { Place } from './types';

/**
 * Place lookup.
 *
 * The bundled directory can never cover every town, so search also queries
 * Open-Meteo's geocoding service — which is free, needs **no API key**, and
 * indexes small localities worldwide (Nagercoil and Kanyakumari included).
 *
 * This is only ever used to resolve *place names*. Weather still comes from
 * whatever `weatherProvider` is configured. Set `ONLINE_GEOCODING` to false to
 * make the app fully offline; search then falls back to the bundled directory.
 */

export const ONLINE_GEOCODING = true;

const ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/search';
const TIMEOUT_MS = 6000;

type GeocodingResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  timezone?: string;
  elevation?: number;
};

/**
 * UTC offset in minutes for an IANA zone.
 *
 * Formats one instant as wall-clock time in the target zone, reads it back as
 * if it were UTC, and takes the difference. Only needs `timeZone` support in
 * `Intl.DateTimeFormat` — no `timeZoneName` parsing, which varies across Hermes
 * builds. Falls back to a longitude estimate if `Intl` can't do it at all.
 */
export function offsetMinutesForTimeZone(timeZone: string, longitude: number, at = Date.now()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(at));

    const read = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const year = read('year');
    const month = read('month');
    const day = read('day');
    // Some ICU builds emit hour 24 for midnight under hour12: false.
    const hour = read('hour') % 24;
    const minute = read('minute');
    const second = read('second');

    if ([year, month, day, hour, minute, second].some(Number.isNaN)) {
      throw new Error('Intl timeZone unsupported');
    }

    const asUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    // Every real-world offset is a multiple of 15 minutes; snapping absorbs the
    // sub-minute error from formatting and keeps India at exactly +05:30.
    return Math.round((asUtc - at) / 60_000 / 15) * 15;
  } catch {
    return Math.round(longitude / 15) * 60;
  }
}

function toPlace(result: GeocodingResult): Place {
  const timezone = result.timezone ?? 'UTC';
  return {
    id: `geo-${result.id}`,
    name: result.name,
    region: result.admin1,
    country: result.country ?? '',
    countryCode: result.country_code,
    coordinates: { latitude: result.latitude, longitude: result.longitude },
    timezone,
    utcOffsetMinutes: offsetMinutesForTimeZone(timezone, result.longitude),
    elevation: result.elevation,
  };
}

/**
 * Look a place up online. Resolves to an empty array on any failure — search
 * degrades to bundled results rather than surfacing a network error for what
 * is a best-effort enrichment.
 */
export async function searchOnline(query: string, signal?: AbortSignal): Promise<Place[]> {
  if (!ONLINE_GEOCODING || query.trim().length < 2) return [];

  // Compose the caller's cancellation with our own timeout.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);

  try {
    const url = `${ENDPOINT}?name=${encodeURIComponent(query.trim())}&count=10&language=en&format=json`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return [];

    const body = (await response.json()) as { results?: GeocodingResult[] };
    return (body.results ?? []).map(toPlace);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
