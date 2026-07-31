import type { Coordinates, Place, WeatherSnapshot } from './types';

/**
 * The single seam between the app and any weather vendor.
 *
 * Screens depend only on this interface, so swapping the mock for a live API is
 * a one-line change in `weather/index.ts` — no component imports move. Write a
 * new adapter, map the vendor payload onto `WeatherSnapshot`, done.
 *
 * @see mock-provider.ts for a reference implementation.
 * @see condition-codes.ts for ready-made vendor-code -> condition mappings.
 */
export interface WeatherProvider {
  /** Shown in the debug panel so it's obvious which source is live. */
  readonly id: string;
  readonly label: string;

  /** Free-text place lookup for the search screen. */
  searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]>;

  /** Turn device coordinates into a `Place`. */
  reverseGeocode(coordinates: Coordinates, signal?: AbortSignal): Promise<Place>;

  /** Current conditions + hourly + daily for one place, in one round trip. */
  getSnapshot(place: Place, signal?: AbortSignal): Promise<WeatherSnapshot>;
}

/** Raised by adapters so the UI can distinguish "offline" from "bad request". */
export class WeatherError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'not-found' | 'rate-limited' | 'unknown' = 'unknown',
  ) {
    super(message);
    this.name = 'WeatherError';
  }
}
