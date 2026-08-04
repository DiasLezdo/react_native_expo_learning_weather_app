import * as Haptics from 'expo-haptics';
import { memo, useCallback, useState } from 'react';
import { Platform, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DOCK_HEIGHT, DOCK_MARGIN, Ink, Space, Type } from '@/design/tokens';
import {
  airQualityLabel,
  formatClock,
  formatTemperature,
  formatWindDirection,
  humidityLabel,
  pressureTrendLabel,
  uvCategory,
  visibilityCategory,
} from '@/weather/format';
import { useSkyState } from '@/sky/use-sky';
import { hasMinutelySignal } from '@/weather/minutely';
import { useWeatherStore } from '@/weather/store';
import type { DailyForecast, Place } from '@/weather/types';
import { AlertBanner } from './alert-banner';
import { DailyForecastList } from './daily-forecast';
import { ErrorState } from './error-state';
import { CompactHeader, WeatherHero } from './hero';
import { HourlyRibbon } from './hourly-ribbon';
import { MetricBar, MetricRing, MetricTile, SunArc, WindCompass } from './metrics';
import { PrecipitationStrip } from './precipitation-strip';
import { ShareButton } from './share-card';
import { GlassSection } from './ui/glass';
import { SkyText } from './ui/sky-text';

/**
 * One city's page inside the Today pager.
 *
 * Each page owns its own vertical scroll position, so the hero parallax and the
 * compact header belong to that city alone and don't jump when you swipe
 * between them.
 */

export type CityPageProps = {
  place: Place;
  /**
   * Sizing lives on the pager's page wrapper, not here.
   *
   * The wrapper is permanent and fixed-size; this component mounts and unmounts
   * inside it as the window moves. That keeps the horizontal scroll container's
   * children constant, which matters because changing a scroll-snap
   * container's children makes the browser re-evaluate its snap position — and
   * that showed up as the pager jumping to another page mid-swipe.
   *
   * `flex: 1` against that fixed height is also what bounds the vertical
   * ScrollView below; without a bounded height it lays out at full content
   * height and never scrolls.
   */
  /** Panel inner width for SVG components that need explicit dimensions. */
  panelWidth: number;
  /** Sun progress for this city, for the daylight arc. */
  sunProgress: number;
  /**
   * Shared with the pager's single sky so it can parallax. Written by whichever
   * page is being scrolled — and only one ever is, since the others aren't
   * under the finger.
   */
  skyScrollY?: SharedValue<number>;
  onSelectDay(day: DailyForecast): void;
};

export const CityPage = memo(function CityPage({
  place,
  panelWidth,
  sunProgress,
  skyScrollY,
  onSelectDay,
}: CityPageProps) {
  const { entries, preferences, refresh, toggleUnit } = useWeatherStore();
  const insets = useSafeAreaInsets();

  const entry = entries[place.id] ?? { loading: true };
  const snapshot = entry.snapshot;
  // Same derivation the pager does for the backdrop; memoised, so deriving it
  // again here costs nothing and keeps the share card's palette in step.
  const sky = useSkyState(snapshot);
  const scrollY = useSharedValue(0);
  const [refreshing, setRefreshing] = useState(false);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    if (skyScrollY) skyScrollY.value = event.contentOffset.y;
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await refresh(place.id, true);
    setRefreshing(false);
  }, [refresh, place.id]);

  const today = snapshot?.daily[0];

  return (
    <View style={styles.page}>
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Space.md,
            paddingBottom: insets.bottom + DOCK_HEIGHT + DOCK_MARGIN + Space.xxl,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={['#FFFFFF']}
            progressBackgroundColor="rgba(255,255,255,0.15)"
          />
        }>
        {!snapshot ? (
          entry.error ? (
            <ErrorState
              kind={entry.errorKind}
              placeName={place.name}
              retrying={entry.loading}
              onRetry={() => void refresh(place.id, true)}
            />
          ) : (
            <View style={styles.loading}>
              <Animated.View
                style={{
                  animationName: {
                    '0%': { opacity: 0.35, transform: [{ scale: 0.96 }] },
                    '50%': { opacity: 1, transform: [{ scale: 1 }] },
                    '100%': { opacity: 0.35, transform: [{ scale: 0.96 }] },
                  },
                  animationDuration: 1600,
                  animationIterationCount: 'infinite',
                  animationTimingFunction: 'ease-in-out',
                }}>
                <SkyText style={[Type.heading, { color: Ink.secondary }]}>
                  Reading the sky over {place.name}…
                </SkyText>
              </Animated.View>
            </View>
          )
        ) : (
          <>
            <WeatherHero
              place={snapshot.place}
              current={snapshot.current}
              today={today}
              unit={preferences.unit}
              scrollY={scrollY}
              yesterdayAtSameHour={snapshot.yesterday?.temperatureAtSameHour}
              onToggleUnit={toggleUnit}
            />

            {/* A cached snapshot plus an error means the last refresh failed —
                show the stale data, but say so rather than pretending. */}
            {entry.error && (
              <View style={styles.staleBanner}>
                <SkyText style={[Type.caption, { color: Ink.secondary }]}>
                  Showing last known conditions · pull to retry
                </SkyText>
              </View>
            )}

            {snapshot.alerts.map((alert, index) => (
              <AlertBanner key={alert.id} alert={alert} index={index} />
            ))}

            {/* Only when there is precipitation in the window — a flat hour of
                nothing on a clear day is noise. */}
            {hasMinutelySignal(snapshot.minutely) && snapshot.minutely && (
              <GlassSection title="Next hour" index={0} contentStyle={styles.minutelyContent}>
                <PrecipitationStrip
                  minutely={snapshot.minutely}
                  condition={snapshot.current.condition}
                />
              </GlassSection>
            )}

            <GlassSection title="Next 24 hours" index={0} contentStyle={styles.ribbonContent}>
              <HourlyRibbon
                hours={snapshot.hourly}
                unit={preferences.unit}
                utcOffsetMinutes={snapshot.place.utcOffsetMinutes}
                use24Hour={preferences.use24Hour}
              />
            </GlassSection>

            <GlassSection title="10-day forecast" index={1}>
              <DailyForecastList
                days={snapshot.daily}
                unit={preferences.unit}
                utcOffsetMinutes={snapshot.place.utcOffsetMinutes}
                currentTemperature={snapshot.current.temperature}
                onSelectDay={onSelectDay}
              />
            </GlassSection>

            {today && (
              <GlassSection
                title="Daylight"
                index={2}
                accessory={
                  <SkyText style={[Type.caption, { color: Ink.secondary }]}>
                    {formatDaylight(today.sunrise, today.sunset)}
                  </SkyText>
                }
                contentStyle={styles.sunContent}>
                <SunArc
                  progress={sunProgress}
                  width={panelWidth}
                  sunriseLabel={formatClock(
                    today.sunrise,
                    snapshot.place.utcOffsetMinutes,
                    preferences.use24Hour,
                  )}
                  sunsetLabel={formatClock(
                    today.sunset,
                    snapshot.place.utcOffsetMinutes,
                    preferences.use24Hour,
                  )}
                />
              </GlassSection>
            )}

            <View style={styles.grid}>
              <MetricTile
                label="UV Index"
                index={3}
                footer={`${uvCategory(snapshot.current.uvIndex)}${
                  snapshot.current.uvIndex >= 6 ? ' · cover up' : ''
                }`}>
                <MetricRing
                  progress={snapshot.current.uvIndex / 11}
                  value={`${Math.round(snapshot.current.uvIndex)}`}
                  caption="of 11"
                  colors={['#FFD152', '#FF5E4D']}
                />
              </MetricTile>

              <MetricTile
                label="Wind"
                index={4}
                footer={`From ${formatWindDirection(snapshot.current.windDirection)} · gusts ${Math.round(
                  snapshot.current.windGust,
                )} km/h`}>
                <WindCompass
                  direction={snapshot.current.windDirection}
                  speed={`${Math.round(snapshot.current.windSpeed)}`}
                  gust="km/h"
                />
              </MetricTile>
            </View>

            <View style={styles.grid}>
              <MetricTile
                label="Humidity"
                index={5}
                footer={humidityLabel(
                  snapshot.current.humidity,
                  snapshot.current.dewPoint,
                  preferences.unit,
                )}>
                <MetricRing
                  progress={snapshot.current.humidity / 100}
                  value={`${snapshot.current.humidity}%`}
                  colors={['#7FD2FF', '#3FD6C4']}
                />
              </MetricTile>

              <MetricTile
                label="Visibility"
                index={6}
                footer={visibilityCategory(snapshot.current.visibility)}>
                <MetricRing
                  progress={Math.min(1, snapshot.current.visibility / 24)}
                  value={`${snapshot.current.visibility}`}
                  caption="km"
                  colors={['#B7A2FF', '#7FD2FF']}
                />
              </MetricTile>
            </View>

            <View style={styles.grid}>
              <MetricTile
                label="Pressure"
                index={7}
                footer={pressureTrendLabel(snapshot.current.pressure)}>
                <MetricBar
                  // Typical sea-level range, 980–1040 hPa.
                  progress={(snapshot.current.pressure - 980) / 60}
                  value={`${snapshot.current.pressure}`}
                  leftLabel="980"
                  rightLabel="1040"
                />
              </MetricTile>

              {snapshot.airQuality ? (
                <MetricTile
                  label="Air quality"
                  index={8}
                  footer={`${airQualityLabel(snapshot.airQuality.category)} · PM2.5 ${
                    snapshot.airQuality.pm25
                  }`}>
                  <MetricRing
                    progress={Math.min(1, snapshot.airQuality.index / 100)}
                    value={`${snapshot.airQuality.index}`}
                    caption="EAQI"
                    colors={['#8BE06B', '#FFD152']}
                  />
                </MetricTile>
              ) : (
                <MetricTile label="Feels like" index={8} footer="Adjusted for wind and humidity">
                  <SkyText style={Type.display}>
                    {formatTemperature(snapshot.current.feelsLike, preferences.unit)}
                  </SkyText>
                </MetricTile>
              )}
            </View>

            <ShareButton
              place={snapshot.place}
              current={snapshot.current}
              today={today}
              sky={sky}
              unit={preferences.unit}
            />

            <SkyText style={[Type.caption, styles.footer]}>
              Updated{' '}
              {formatClock(snapshot.fetchedAt, snapshot.place.utcOffsetMinutes, preferences.use24Hour)}
              {'  ·  '}
              Pull to refresh
            </SkyText>
          </>
        )}
      </Animated.ScrollView>

      {/* After the scroll view so it paints above it without relying on
          zIndex, which Android honours inconsistently. */}
      {snapshot && (
        <CompactHeader
          place={snapshot.place}
          current={snapshot.current}
          unit={preferences.unit}
          scrollY={scrollY}
          topInset={insets.top}
        />
      )}
    </View>
  );
});

/** "13h 42m of light" for the section accessory. */
function formatDaylight(sunrise: number, sunset: number) {
  const minutes = Math.max(0, Math.round((sunset - sunrise) / 60_000));
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m of light`;
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Space.lg,
    gap: Space.md,
  },
  ribbonContent: {
    paddingHorizontal: 0,
    marginHorizontal: -Space.md,
  },
  minutelyContent: {
    paddingHorizontal: 0,
  },
  sunContent: {
    paddingHorizontal: Space.md,
  },
  grid: {
    flexDirection: 'row',
    gap: Space.md,
  },
  loading: {
    flex: 1,
    minHeight: 400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staleBanner: {
    alignItems: 'center',
    paddingVertical: Space.xxs,
  },
  footer: {
    textAlign: 'center',
    color: Ink.quaternary,
    marginTop: Space.xs,
  },
});
