import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityPage } from '@/components/city-page';
import { DayDetailSheet } from '@/components/day-detail-sheet';
import { PageDots } from '@/components/page-dots';
import { DOCK_HEIGHT, DOCK_MARGIN, Space } from '@/design/tokens';
import { StormRumble } from '@/sky/layers/effects';
import { SkyBackground } from '@/sky/sky-background';
import { useSkyState } from '@/sky/use-sky';
import { CURRENT_LOCATION_ID } from '@/weather/device-location';
import { useWeatherStore } from '@/weather/store';
import type { DailyForecast } from '@/weather/types';

/**
 * Today.
 *
 * A horizontal pager, one page per saved city, over a single full-bleed sky.
 *
 * The sky is deliberately *not* per page. Mounting a full weather simulation
 * for every city would multiply particle counts by the number of pages; instead
 * one sky follows the settled page and dissolves into the next using the
 * cross-fade `SkyBackground` already performs. Swiping therefore slides the
 * content while the weather behind it melts from one city's to the other's.
 */

/** Pages beyond this distance from the current one render as blanks. */
const WINDOW = 1;

/**
 * Quiet time after the last scroll event before a page is considered settled.
 *
 * Long enough to outlast the gap between frames of a decelerating scroll, short
 * enough that the sky starts changing as soon as you let go.
 */
const SETTLE_MS = 110;

export default function TodayScreen() {
  const { places, activePlaceId, entries, preferences, motionEnabled, hydrated, setActivePlaceId } =
    useWeatherStore();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);
  const pagerProgress = useSharedValue(0);
  // One value for the one sky, written by whichever page is being scrolled.
  const skyScrollY = useSharedValue(0);
  const [selectedDay, setSelectedDay] = useState<{ placeId: string; day: DailyForecast } | null>(null);
  /*
   * Measured rather than taken from `useWindowDimensions`, which reports the
   * whole window — including space this view doesn't occupy under translucent
   * system bars. Pages sized to that would over-scroll by the difference.
   * Seeded with the window height so the first frame is close.
   */
  const [pageHeight, setPageHeight] = useState(height);

  /*
   * The current page is derived from the store rather than mirrored into local
   * state. Keeping a second copy meant an effect that wrote state on every
   * change — a cascading render for something already known.
   */
  const activeIndex = useMemo(
    () => Math.max(0, places.findIndex((place) => place.id === activePlaceId)),
    [places, activePlaceId],
  );

  /*
   * Where the pager has physically been placed, and at what width. A ref, so
   * settling a swipe doesn't schedule a render purely to record where we
   * already are. The width is part of it because a resize invalidates the
   * offset — `index * width` moves even though the index hasn't.
   */
  const placed = useRef({ index: activeIndex, width });

  const visiblePlace = places[activeIndex] ?? places[0];
  const sky = useSkyState(entries[visiblePlace?.id ?? '']?.snapshot);

  /**
   * Commit a page: make it the active place, which both mounts its content and
   * hands the sky over to its weather. Idempotent, because it is reached from
   * two directions.
   */
  const commitPage = useCallback(
    (index: number) => {
      const clamped = Math.min(places.length - 1, Math.max(0, index));
      if (clamped === placed.current.index) return;

      // Recorded before the store update, so the realign effect below sees this
      // page as already handled and leaves the pager alone.
      placed.current = { index: clamped, width };
      const place = places[clamped];
      if (place) {
        setActivePlaceId(place.id);
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
      }
    },
    [places, setActivePlaceId, width],
  );

  /*
   * Commit once scrolling has stopped, not the moment the offset touches a page
   * boundary.
   *
   * `onMomentumScrollEnd` doesn't fire on web, so the settled page has to come
   * from the offset — but a fast swipe *travels through* the boundaries between
   * here and its destination. Committing on contact meant a 0 -> 2 swipe
   * committed page 1 in passing, and the sync effect below then dutifully
   * scrolled back to it.
   *
   * Each scroll event reschedules, so only the final resting position survives.
   */
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleCommit = useCallback(
    (offsetX: number) => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        settleTimer.current = null;
        commitPage(Math.round(offsetX / Math.max(1, width)));
      }, SETTLE_MS);
    },
    [width, commitPage],
  );

  useEffect(() => {
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, []);

  const pagerHandler = useAnimatedScrollHandler((event) => {
    if (width <= 0) return;
    pagerProgress.value = event.contentOffset.x / width;
    runOnJS(scheduleCommit)(event.contentOffset.x);
  });

  /*
   * Jump to whatever the rest of the app made active — the Cities screen
   * selecting a city, or a fresh location fix pinned to the front. Skipped when
   * the pager is already there, which is the case after a swipe.
   *
   * `pagerProgress` needs no manual update: RN emits scroll events for
   * programmatic scrolls too, so the handler above keeps the dots in step.
   */
  useEffect(() => {
    if (placed.current.index === activeIndex && placed.current.width === width) return;
    placed.current = { index: activeIndex, width };
    scrollRef.current?.scrollTo({ x: activeIndex * width, animated: false });
  }, [activeIndex, width]);

  // Native still gets the momentum event, which commits marginally sooner than
  // the offset check above. Both funnel into the same idempotent commit.
  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      commitPage(Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width)));
    },
    [width, commitPage],
  );

  const panelWidth = width - Space.lg * 2 - Space.md * 2;
  const locationIndex = places.findIndex((place) => place.id === CURRENT_LOCATION_ID);

  const selectedSnapshot = selectedDay ? entries[selectedDay.placeId]?.snapshot : undefined;
  const selectedPlace = places.find((place) => place.id === selectedDay?.placeId);

  return (
    <StormRumble active={sky.condition === 'thunderstorm' && motionEnabled}>
      <View
        style={styles.root}
        onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}>
        <SkyBackground
          state={sky}
          width={width}
          height={height}
          quality={preferences.quality}
          motion={motionEnabled}
          scrollY={skyScrollY}
        />

        {/* Nothing renders until persisted cities are known, so the pager
            never builds pages for the defaults and then rebuilds them. */}
        {hydrated && (
          <Animated.ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={pagerHandler}
            onMomentumScrollEnd={onMomentumEnd}
            scrollEventThrottle={16}
            // Each page owns a vertical scroll view; without this the pager
            // steals ambiguous diagonal drags on Android.
            directionalLockEnabled>
            {places.map((place, index) => (
              /*
               * The wrapper is permanent and fixed-size; only its contents come
               * and go. Swapping whole children in and out of a scroll-snap
               * container makes the browser re-evaluate where it should be
               * snapped, which read as the pager throwing you onto a different
               * page mid-swipe.
               */
              <View key={place.id} style={{ width, height: pageHeight }}>
                {Math.abs(index - activeIndex) <= WINDOW ? (
                  <CityPage
                    place={place}
                    panelWidth={panelWidth}
                    sunProgress={sky.sunProgress}
                    skyScrollY={skyScrollY}
                    onSelectDay={(day) => setSelectedDay({ placeId: place.id, day })}
                  />
                ) : null}
              </View>
            ))}
          </Animated.ScrollView>
        )}

        <PageDots
          count={places.length}
          progress={pagerProgress}
          locationIndex={locationIndex}
          bottom={insets.bottom + DOCK_HEIGHT + DOCK_MARGIN + Space.sm}
        />

        {selectedDay && selectedSnapshot && selectedPlace && (
          <DayDetailSheet
            day={selectedDay.day}
            hourly={selectedSnapshot.hourly}
            place={selectedPlace}
            unit={preferences.unit}
            use24Hour={preferences.use24Hour}
            onClose={() => setSelectedDay(null)}
          />
        )}
      </View>
    </StormRumble>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
