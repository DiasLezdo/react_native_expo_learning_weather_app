import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Platform, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertBanner } from '@/components/alert-banner';
import { DailyForecastList } from '@/components/daily-forecast';
import { CompactHeader, WeatherHero } from '@/components/hero';
import { HourlyRibbon } from '@/components/hourly-ribbon';
import { MetricBar, MetricRing, MetricTile, SunArc, WindCompass } from '@/components/metrics';
import { GlassSection } from '@/components/ui/glass';
import { SkyText } from '@/components/ui/sky-text';
import { DOCK_HEIGHT, DOCK_MARGIN, Ink, Space, Type } from '@/design/tokens';
import { StormRumble } from '@/sky/layers/effects';
import { SkyBackground } from '@/sky/sky-background';
import { useSkyState } from '@/sky/use-sky';
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
import { useWeatherStore } from '@/weather/store';

/**
 * Today.
 *
 * One scroll surface floating over a live simulation of the current weather.
 */
export default function TodayScreen() {
  const { activePlace, active, preferences, refresh, toggleUnit } = useWeatherStore();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const snapshot = active.snapshot;
  const sky = useSkyState(snapshot);
  const scrollY = useSharedValue(0);
  const [refreshing, setRefreshing] = useState(false);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await refresh(activePlace.id, true);
    setRefreshing(false);
  }, [refresh, activePlace.id]);

  // Panel inner width, used by SVG components that need explicit dimensions.
  const panelWidth = width - Space.lg * 2 - Space.md * 2;
  const today = snapshot?.daily[0];

  return (
    <StormRumble active={sky.condition === 'thunderstorm' && preferences.motionEnabled}>
      <View style={styles.root}>
        <SkyBackground
          state={sky}
          width={width}
          height={height}
          quality={preferences.quality}
          motion={preferences.motionEnabled}
        />

        <Animated.ScrollView
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + Space.md,
              paddingBottom: insets.bottom + DOCK_HEIGHT + DOCK_MARGIN + Space.xl,
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
                  {active.error ?? `Reading the sky over ${activePlace.name}…`}
                </SkyText>
              </Animated.View>
            </View>
          ) : (
            <>
              <WeatherHero
                place={snapshot.place}
                current={snapshot.current}
                today={today}
                unit={preferences.unit}
                scrollY={scrollY}
                onToggleUnit={toggleUnit}
              />

              {snapshot.alerts.map((alert, index) => (
                <AlertBanner key={alert.id} alert={alert} index={index} />
              ))}

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
                    progress={sky.sunProgress}
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

              <SkyText style={[Type.caption, styles.footer]}>
                Updated {formatClock(snapshot.fetchedAt, snapshot.place.utcOffsetMinutes, preferences.use24Hour)}
                {'  ·  '}
                Pull to refresh
              </SkyText>
            </>
          )}
        </Animated.ScrollView>

        {/* Rendered after the scroll view so it paints above it without
            relying on zIndex, which Android honours inconsistently. */}
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
    </StormRumble>
  );
}

/** "13h 42m of daylight" for the section accessory. */
function formatDaylight(sunrise: number, sunset: number) {
  const minutes = Math.max(0, Math.round((sunset - sunrise) / 60_000));
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m of light`;
}

const styles = StyleSheet.create({
  root: {
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
  footer: {
    textAlign: 'center',
    color: Ink.quaternary,
    marginTop: Space.xs,
  },
});
