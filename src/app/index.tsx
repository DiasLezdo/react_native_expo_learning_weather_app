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
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
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

export default function TodayScreen() {
  const { places, activePlaceId, entries, preferences, hydrated, setActivePlaceId } =
    useWeatherStore();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);
  const pagerProgress = useSharedValue(0);
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

  // Last index the pager was physically moved to. A ref, so settling a swipe
  // doesn't schedule a render purely to record where we already are.
  const scrolledIndex = useRef(activeIndex);

  const visiblePlace = places[activeIndex] ?? places[0];
  const sky = useSkyState(entries[visiblePlace?.id ?? '']?.snapshot);

  const pagerHandler = useAnimatedScrollHandler((event) => {
    pagerProgress.value = width > 0 ? event.contentOffset.x / width : 0;
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
    if (scrolledIndex.current === activeIndex) return;
    scrolledIndex.current = activeIndex;
    scrollRef.current?.scrollTo({ x: activeIndex * width, animated: false });
  }, [activeIndex, width]);

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
      if (next === activeIndex) return;

      // Record it first, so the effect above treats this as already handled.
      scrolledIndex.current = next;

      const place = places[next];
      if (place) {
        setActivePlaceId(place.id);
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
      }
    },
    [width, activeIndex, places, setActivePlaceId],
  );

  const panelWidth = width - Space.lg * 2 - Space.md * 2;
  const locationIndex = places.findIndex((place) => place.id === CURRENT_LOCATION_ID);

  const selectedSnapshot = selectedDay ? entries[selectedDay.placeId]?.snapshot : undefined;
  const selectedPlace = places.find((place) => place.id === selectedDay?.placeId);

  return (
    <StormRumble active={sky.condition === 'thunderstorm' && preferences.motionEnabled}>
      <View
        style={styles.root}
        onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}>
        <SkyBackground
          state={sky}
          width={width}
          height={height}
          quality={preferences.quality}
          motion={preferences.motionEnabled}
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
            {places.map((place, index) =>
              Math.abs(index - activeIndex) <= WINDOW ? (
                <CityPage
                  key={place.id}
                  place={place}
                  width={width}
                  height={pageHeight}
                  panelWidth={panelWidth}
                  sunProgress={sky.sunProgress}
                  onSelectDay={(day) => setSelectedDay({ placeId: place.id, day })}
                />
              ) : (
                // Placeholder keeps the pager's geometry correct without
                // mounting a screenful of views for a city you can't see.
                <View key={place.id} style={{ width, height: pageHeight }} />
              ),
            )}
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
