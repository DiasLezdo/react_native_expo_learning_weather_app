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

import type { SkyQuality } from '@/sky/types';
import { DEFAULT_PLACES } from './mock-provider';
import { weatherProvider } from './index';
import type { Place, TemperatureUnit, WeatherSnapshot } from './types';

/**
 * App-wide weather state.
 *
 * Snapshots are cached per place id so switching cities is instant and a
 * revisit never shows a spinner — a stale snapshot renders immediately while
 * the refresh happens behind it.
 */

type SnapshotEntry = {
  snapshot?: WeatherSnapshot;
  loading: boolean;
  error?: string;
};

type Preferences = {
  unit: TemperatureUnit;
  use24Hour: boolean;
  quality: SkyQuality;
  /** Master switch honoured by every animated layer. */
  motionEnabled: boolean;
};

type WeatherStore = {
  places: Place[];
  activePlaceId: string;
  activePlace: Place;
  entries: Record<string, SnapshotEntry>;
  active: SnapshotEntry;
  preferences: Preferences;

  setActivePlaceId(id: string): void;
  addPlace(place: Place): void;
  removePlace(id: string): void;
  refresh(placeId?: string, force?: boolean): Promise<void>;
  setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void;
  toggleUnit(): void;
};

const WeatherContext = createContext<WeatherStore | null>(null);

/** Snapshots older than this are refetched when a place becomes visible. */
const STALE_AFTER_MS = 10 * 60_000;

export function WeatherStoreProvider({ children }: { children: ReactNode }) {
  const [places, setPlaces] = useState<Place[]>(DEFAULT_PLACES);
  const [activePlaceId, setActivePlaceId] = useState<string>(DEFAULT_PLACES[0].id);
  const [entries, setEntries] = useState<Record<string, SnapshotEntry>>({});
  const [preferences, setPreferences] = useState<Preferences>({
    unit: 'c',
    use24Hour: false,
    quality: 'high',
    motionEnabled: true,
  });

  // One in-flight request per place; a second call for the same place is a
  // no-op rather than a duplicate fetch.
  const inFlight = useRef(new Map<string, AbortController>());
  // Mirror of `entries` for freshness probes. Reading state directly inside
  // `refresh` would capture a stale closure and refetch data we already have.
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

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
          },
        }));
      } finally {
        inFlight.current.delete(id);
      }
    },
    [activePlaceId, places],
  );

  // Warm the active place, plus every other saved place in the background so
  // the Cities screen is populated before the user gets there.
  useEffect(() => {
    void refresh(activePlaceId);
  }, [activePlaceId, refresh]);

  useEffect(() => {
    const timer = setTimeout(() => {
      for (const place of places) {
        if (place.id !== activePlaceId) void refresh(place.id);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [places, activePlaceId, refresh]);

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
      setActivePlaceId,
      addPlace,
      removePlace,
      refresh,
      setPreference,
      toggleUnit,
    }),
    [
      places,
      activePlaceId,
      activePlace,
      entries,
      active,
      preferences,
      addPlace,
      removePlace,
      refresh,
      setPreference,
      toggleUnit,
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
