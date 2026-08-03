import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { weatherProvider } from './index';
import type { Place } from './types';

/**
 * "Weather where I am".
 *
 * Resolving coordinates to a named place uses the OS geocoder rather than a
 * network service — it is offline, needs no key, and is more accurate for
 * small localities than anything we could query. `reverseGeocodeAsync` is not
 * available on web, so there we fall back to the nearest place the provider
 * knows about.
 */

/** Stable id, so a refreshed fix updates the same entry instead of adding one. */
export const CURRENT_LOCATION_ID = 'current-location';

export type LocationOutcome =
  | { status: 'granted'; place: Place }
  | { status: 'denied' }
  | { status: 'unavailable'; reason: string };

/**
 * The device's own timezone.
 *
 * Sound precisely because this is the user's *current* location: if they are
 * standing there, the device clock is already set to that zone. For any other
 * city the offset comes from the place record instead.
 */
function deviceTimeZone() {
  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    // Hermes without full ICU. The numeric offset below still works.
  }
  // `getTimezoneOffset` is minutes *behind* UTC, so the sign is inverted.
  return { timezone, utcOffsetMinutes: -new Date().getTimezoneOffset() };
}

export async function resolveCurrentPlace(): Promise<LocationOutcome> {
  let permission: Location.LocationPermissionResponse;

  try {
    permission = await Location.requestForegroundPermissionsAsync();
  } catch (error) {
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : 'Location is not available',
    };
  }

  if (!permission.granted) return { status: 'denied' };

  let position: Location.LocationObject;
  try {
    // Balanced is ~100m, which is far more precision than a weather forecast
    // needs, and it settles much faster than High on a cold start.
    position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  } catch (error) {
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : 'Could not get a location fix',
    };
  }

  const { latitude, longitude, altitude } = position.coords;
  const { timezone, utcOffsetMinutes } = deviceTimeZone();

  const base: Place = {
    id: CURRENT_LOCATION_ID,
    name: 'Current Location',
    country: '',
    coordinates: { latitude, longitude },
    timezone,
    utcOffsetMinutes,
    // Devices often report altitude; when they do, the climate model uses it.
    elevation: typeof altitude === 'number' && Number.isFinite(altitude) ? altitude : undefined,
  };

  if (Platform.OS === 'web') {
    // No OS reverse geocoder here — borrow the nearest known place's name but
    // keep the real coordinates, so the forecast is still for where you are.
    try {
      const nearest = await weatherProvider.reverseGeocode({ latitude, longitude });
      return {
        status: 'granted',
        place: { ...base, name: nearest.name, region: nearest.region, country: nearest.country },
      };
    } catch {
      return { status: 'granted', place: base };
    }
  }

  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!address) return { status: 'granted', place: base };

    return {
      status: 'granted',
      place: {
        ...base,
        // `city` is empty in rural areas; district and subregion fill the gap.
        name: address.city ?? address.district ?? address.subregion ?? base.name,
        region: address.region ?? undefined,
        country: address.country ?? '',
        countryCode: address.isoCountryCode ?? undefined,
      },
    };
  } catch {
    // A named place is nice to have; the forecast does not depend on it.
    return { status: 'granted', place: base };
  }
}
