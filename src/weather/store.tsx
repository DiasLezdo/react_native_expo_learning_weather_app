import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import { loadJson, saveJson, STORAGE_KEYS } from '@/lib/storage';
import type { SkyQuality } from '@/sky/types';
import { CURRENT_LOCATION_ID, resolveCurrentPlace, type LocationOutcome } from './device-location';
import { DEFAULT_PLACES } from './mock-provider';
import { WeatherError } from './provider';
import { weatherProvider } from './index';
import type { Place, TemperatureUnit, WeatherSnapshot } from './types';

/**
 * App-wide weather state.
 *
 * Snapshots are cached per place id so switching cities is instant and a
 * revisit never shows a spinner — a stale snapshot renders immediately while
 * the refresh happens behind it.
 *
 * Saved cities and preferences persist; cached snapshots deliberately do not.
 * Weather goes stale in minutes, so restoring it would only mean showing
 * yesterday's forecast for a moment before replacing it.
 */

type SnapshotEntry = {
  snapshot?: WeatherSnapshot;
  loading: boolean;
  error?: string;
  /** Kept alongside the message so the UI can say "offline" and mean it. */
  errorKind?: WeatherError['kind'];
};

/**
 * `auto` follows the operating system's reduce-motion setting.
 *
 * It is the default, and it matters: a user who has turned reduce-motion on
 * system-wide — very often for vestibular reasons — should not have to find a
 * switch inside this app to stop a screen full of rain, lightning and a
 * rumbling viewport. The explicit values exist so the choice can still be
 * overridden either way.
 */
export type MotionPreference = 'auto' | 'on' | 'off';

export type Preferences = {
  unit: TemperatureUnit;
  use24Hour: boolean;
  quality: SkyQuality;
  motionPreference: MotionPreference;
};

const DEFAULT_PREFERENCES: Preferences = {
  unit: 'c',
  use24Hour: false,
  quality: 'high',
  motionPreference: 'auto',
};

/** Shape written to storage. */
type PersistedState = {
  places: Place[];
  activePlaceId: string;
  preferences: Preferences;
};

export type LocationStatus = 'idle' | 'locating' | 'granted' | 'denied' | 'unavailable';

type WeatherStore = {
  places: Place[];
  activePlaceId: string;
  activePlace: Place;
  entries: Record<string, SnapshotEntry>;
  active: SnapshotEntry;
  preferences: Preferences;
  /**
   * Resolved answer to "should anything be moving?" — the preference combined
   * with the OS setting. Screens read this; they never read the preference.
   */
  motionEnabled: boolean;
  /** True when the OS has reduce-motion on, so the UI can explain `auto`. */
  systemReducedMotion: boolean;
  /** False until persisted state has been read; screens wait on it. */
  hydrated: boolean;
  locationStatus: LocationStatus;

  setActivePlaceId(id: string): void;
  addPlace(place: Place): void;
  removePlace(id: string): void;
  refresh(placeId?: string, force?: boolean): Promise<void>;
  setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void;
  toggleUnit(): void;
  /**
   * Ask for a fix and pin the result as "Current Location".
   *
   * Not named `use…`: it is a store method, and the hooks lint rule would
   * otherwise treat every call site as a conditional hook call.
   */
  requestDeviceLocation(): Promise<LocationOutcome>;
};

const WeatherContext = createContext<WeatherStore | null>(null);

/** Snapshots older than this are refetched when a place becomes visible. */
const STALE_AFTER_MS = 10 * 60_000;

/**
 * Persisted data is untrusted input — it may predate a schema change or have
 * been truncated mid-write. Anything that fails this check is discarded in
 * favour of the defaults.
 */
function isValidPlace(value: unknown): value is Place {
  if (!value || typeof value !== 'object') return false;
  const place = value as Partial<Place>;
  return (
    typeof place.id === 'string' &&
    typeof place.name === 'string' &&
    typeof place.timezone === 'string' &&
    typeof place.utcOffsetMinutes === 'number' &&
    !!place.coordinates &&
    typeof place.coordinates.latitude === 'number' &&
    typeof place.coordinates.longitude === 'number'
  );
}

function parsePersisted(value: PersistedState | null): PersistedState | null {
  if (!value || typeof value !== 'object') return null;

  const places = Array.isArray(value.places) ? value.places.filter(isValidPlace) : [];
  if (!places.length) return null;

  const activePlaceId = places.some((p) => p.id === value.activePlaceId)
    ? value.activePlaceId
    : places[0].id;

  return {
    places,
    activePlaceId,
    // Merge over defaults so a preference added in a later version is present.
    preferences: { ...DEFAULT_PREFERENCES, ...(value.preferences ?? {}) },
  };
}

export function WeatherStoreProvider({ children }: { children: ReactNode }) {
  const [places, setPlaces] = useState<Place[]>(DEFAULT_PLACES);
  const [activePlaceId, setActivePlaceId] = useState<string>(DEFAULT_PLACES[0].id);
  const [entries, setEntries] = useState<Record<string, SnapshotEntry>>({});
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');

  // Reanimated already tracks the OS setting and keeps this current.
  const systemReducedMotion = useReducedMotion();
  const motionEnabled =
    preferences.motionPreference === 'auto'
      ? !systemReducedMotion
      : preferences.motionPreference === 'on';

  // One in-flight request per place; a second call for the same place is a
  // no-op rather than a duplicate fetch.
  const inFlight = useRef(new Map<string, AbortController>());
  // Mirror of `entries` for freshness probes. Reading state directly inside
  // `refresh` would capture a stale closure and refetch data we already have.
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  // Read persisted state once, before anything is fetched.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = parsePersisted(await loadJson<PersistedState>(STORAGE_KEYS.appState));
      if (cancelled) return;

      if (stored) {
        setPlaces(stored.places);
        setActivePlaceId(stored.activePlaceId);
        setPreferences(stored.preferences);
      }
      setHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Write it back on every change — but never before the read completes, or
  // the defaults would overwrite the user's saved cities on launch.
  useEffect(() => {
    if (!hydrated) return;
    void saveJson(STORAGE_KEYS.appState, { places, activePlaceId, preferences } satisfies PersistedState);
  }, [hydrated, places, activePlaceId, preferences]);

  const refresh = useCallback(
    async (placeId?: string, force = false) => {
      const id = placeId ?? activePlaceId;
      const place = places.find((p) => p.id === id);
      if (!place) return;
      if (inFlight.current.has(id)) return;

      const cached = entriesRef.current[id]?.snapshot;
      if (!force && cached && Date.now() - cached.fetchedAt < STALE_AFTER_MS) return;

      setEntries((prev) => ({ ...prev, [id]: { ...prev[id], loading: true, error: undefined } }));

      const controller = new AbortController();
      inFlight.current.set(id, controller);

      try {
        const snapshot = await weatherProvider.getSnapshot(place, controller.signal);
        setEntries((prev) => ({ ...prev, [id]: { snapshot, loading: false } }));
      } catch (error) {
        if (controller.signal.aborted) return;
        setEntries((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            loading: false,
            error: error instanceof Error ? error.message : 'Could not load weather',
            errorKind: error instanceof WeatherError ? error.kind : 'unknown',
          },
        }));
      } finally {
        inFlight.current.delete(id);
      }
    },
    [activePlaceId, places],
  );

  // Warm the active place, plus every other saved place in the background so
  // the Cities screen is populated before the user gets there. Both wait for
  // hydration, otherwise the default cities would be fetched and then thrown
  // away the moment the saved list arrives.
  useEffect(() => {
    if (!hydrated) return;
    void refresh(activePlaceId);
  }, [hydrated, activePlaceId, refresh]);

  useEffect(() => {
    if (!hydrated) return;

    const timer = setTimeout(() => {
      for (const place of places) {
        if (place.id !== activePlaceId) void refresh(place.id);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [hydrated, places, activePlaceId, refresh]);

  useEffect(() => {
    const controllers = inFlight.current;
    return () => {
      for (const controller of controllers.values()) controller.abort();
      controllers.clear();
    };
  }, []);

  const addPlace = useCallback((place: Place) => {
    setPlaces((prev) => (prev.some((p) => p.id === place.id) ? prev : [...prev, place]));
    setActivePlaceId(place.id);
  }, []);

  const removePlace = useCallback(
    (id: string) => {
      // Never leave the app with nothing to show.
      if (places.length <= 1) return;

      const next = places.filter((p) => p.id !== id);
      setPlaces(next);
      if (activePlaceId === id) setActivePlaceId(next[0].id);
    },
    [places, activePlaceId],
  );

  const setPreference = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleUnit = useCallback(() => {
    setPreferences((prev) => ({ ...prev, unit: prev.unit === 'c' ? 'f' : 'c' }));
  }, []);

  const requestDeviceLocation = useCallback(async (): Promise<LocationOutcome> => {
    setLocationStatus('locating');
    const outcome = await resolveCurrentPlace();

    if (outcome.status !== 'granted') {
      setLocationStatus(outcome.status);
      return outcome;
    }

    setLocationStatus('granted');
    // Replace any previous fix and pin it first, so "where I am" is always the
    // opening page of the pager.
    setPlaces((prev) => [outcome.place, ...prev.filter((p) => p.id !== CURRENT_LOCATION_ID)]);
    // Drop the cached snapshot: the coordinates behind this id have moved, so
    // the freshness check would otherwise serve weather for the old position.
    setEntries((prev) => {
      const next = { ...prev };
      delete next[CURRENT_LOCATION_ID];
      return next;
    });
    setActivePlaceId(CURRENT_LOCATION_ID);

    return outcome;
  }, []);

  const activePlace = useMemo(
    () => places.find((p) => p.id === activePlaceId) ?? places[0],
    [places, activePlaceId],
  );

  const active = useMemo<SnapshotEntry>(
    () => entries[activePlaceId] ?? { loading: true },
    [entries, activePlaceId],
  );

  const value = useMemo<WeatherStore>(
    () => ({
      places,
      activePlaceId,
      activePlace,
      entries,
      active,
      preferences,
      motionEnabled,
      systemReducedMotion,
      hydrated,
      locationStatus,
      setActivePlaceId,
      addPlace,
      removePlace,
      refresh,
      setPreference,
      toggleUnit,
      requestDeviceLocation,
    }),
    [
      places,
      activePlaceId,
      activePlace,
      entries,
      active,
      preferences,
      motionEnabled,
      systemReducedMotion,
      hydrated,
      locationStatus,
      addPlace,
      removePlace,
      refresh,
      setPreference,
      toggleUnit,
      requestDeviceLocation,
    ],
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

export function useWeatherStore() {
  const store = useContext(WeatherContext);
  if (!store) throw new Error('useWeatherStore must be used inside <WeatherStoreProvider>');
  return store;
}

/** Snapshot for a specific place, or the active one when omitted. */
export function useSnapshot(placeId?: string) {
  const { entries, active } = useWeatherStore();
  return placeId ? (entries[placeId] ?? { loading: true }) : active;
}

export function usePreferences() {
  return useWeatherStore().preferences;
}
