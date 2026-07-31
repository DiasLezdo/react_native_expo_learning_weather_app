import { useEffect, useMemo, useState } from 'react';

import { hashSeed } from '@/lib/rng';
import type { WeatherSnapshot } from '@/weather/types';
import { deriveSkyState } from './derive';
import type { SkyState } from './types';

/**
 * A clock that ticks slowly.
 *
 * The sky has to notice when the sun sets, but nothing about the background
 * changes between minutes — so it re-renders once a minute rather than
 * subscribing to anything faster.
 */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

/** Neutral sky shown while the first snapshot is still loading. */
export const FALLBACK_SKY: SkyState = {
  condition: 'partly-cloudy',
  dayPart: 'day',
  intensity: 0.4,
  windSpeed: 12,
  temperature: 18,
  sunProgress: 0.45,
  moonPhase: 0.5,
  seed: hashSeed('loading'),
};

export function useSkyState(snapshot: WeatherSnapshot | undefined): SkyState {
  const now = useNow();

  return useMemo(() => {
    if (!snapshot) return FALLBACK_SKY;
    return deriveSkyState(snapshot, now);
  }, [snapshot, now]);
}
