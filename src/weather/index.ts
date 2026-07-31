import { mockProvider } from './mock-provider';
import type { WeatherProvider } from './provider';

/**
 * The active data source.
 *
 * This is the only line that changes when the live API arrives:
 *
 *   import { myApiProvider } from './my-api-provider';
 *   export const weatherProvider: WeatherProvider = myApiProvider;
 *
 * Write the adapter against the `WeatherProvider` interface, map the vendor
 * payload onto `WeatherSnapshot`, and every screen picks it up unchanged.
 */
export const weatherProvider: WeatherProvider = mockProvider;

export * from './types';
export * from './provider';
export * from './format';
export { DEFAULT_PLACES, previewSnapshot } from './mock-provider';
export { conditionFromWmoCode, conditionFromOpenWeatherId, conditionFromText } from './condition-codes';
