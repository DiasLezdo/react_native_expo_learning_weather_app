import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { Ink, Radius, Space, Type } from '@/design/tokens';
import {
  compareToYesterday,
  conditionTagline,
  convertTemperature,
  formatPlace,
  formatTemperature,
} from '@/weather/format';
import { CONDITION_LABEL, type CurrentWeather, type DailyForecast, type Place, type TemperatureUnit } from '@/weather/types';
import { SkyText } from './ui/sky-text';
import { WeatherIcon } from './weather-icon';

/**
 * The hero, and the compact header that replaces it.
 *
 * Scrolling reads as *descending through the atmosphere*: the hero lags behind
 * the content, shrinks and dissolves, while a compact bar condenses out of it
 * at the top. Both transforms are driven from one shared scroll value on the UI
 * thread, so the handoff stays locked to the finger at any scroll speed.
 */

/** Scroll distance over which the hero gives way to the compact header. */
const HANDOFF = 210;

export type WeatherHeroProps = {
  place: Place;
  current: CurrentWeather;
  today?: DailyForecast;
  unit: TemperatureUnit;
  scrollY: SharedValue<number>;
  /**
   * Yesterday's temperature at this same hour, in °C. When present it replaces
   * the generic tagline, because a concrete comparison beats a mood line.
   */
  yesterdayAtSameHour?: number;
  onToggleUnit(): void;
};

export const WeatherHero = memo(function WeatherHero({
  place,
  current,
  today,
  unit,
  scrollY,
  yesterdayAtSameHour,
  onToggleUnit,
}: WeatherHeroProps) {
  const yesterdayComparison =
    yesterdayAtSameHour === undefined
      ? null
      : compareToYesterday(current.temperature, yesterdayAtSameHour, unit);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HANDOFF * 0.85], [1, 0], Extrapolation.CLAMP),
    transform: [
      // Positive translate = the hero falls behind the content it sits in.
      { translateY: interpolate(scrollY.value, [0, HANDOFF], [0, 84], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [0, HANDOFF], [1, 0.86], Extrapolation.CLAMP) },
    ],
  }));

  const handleToggle = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggleUnit();
  };

  return (
    <Animated.View style={[styles.hero, animatedStyle]}>
      <Animated.View
        style={{
          alignItems: 'center',
          gap: 2,
          opacity: 0,
          animationName: {
            from: { opacity: 0, transform: [{ translateY: -14 }] },
            to: { opacity: 1, transform: [{ translateY: 0 }] },
          },
          animationDuration: 700,
          animationFillMode: 'forwards',
          animationTimingFunction: 'ease-out',
        }}>
        <SkyText style={[Type.title, styles.place]} numberOfLines={1}>
          {formatPlace(place)}
        </SkyText>
        <SkyText style={[Type.label, { color: Ink.tertiary }]}>
          {CONDITION_LABEL[current.condition].toUpperCase()}
        </SkyText>
      </Animated.View>

      <Pressable
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel={`Temperature ${formatTemperature(current.temperature, unit)}. Tap to switch units.`}
        style={styles.tempRow}>
        <Animated.View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            opacity: 0,
            animationName: {
              from: { opacity: 0, transform: [{ scale: 0.9 }] },
              to: { opacity: 1, transform: [{ scale: 1 }] },
            },
            animationDuration: 820,
            animationDelay: 90,
            animationFillMode: 'forwards',
            animationTimingFunction: 'ease-out',
          }}>
          <SkyText style={[Type.hero, styles.temp]}>
            {Math.round(convertTemperature(current.temperature, unit))}
          </SkyText>
          <View style={styles.unitStack}>
            <SkyText style={styles.degree}>°</SkyText>
            <SkyText style={[Type.label, styles.unit]}>{unit.toUpperCase()}</SkyText>
          </View>
        </Animated.View>
      </Pressable>

      <Animated.View
        style={{
          alignItems: 'center',
          gap: Space.xs,
          opacity: 0,
          animationName: {
            from: { opacity: 0, transform: [{ translateY: 14 }] },
            to: { opacity: 1, transform: [{ translateY: 0 }] },
          },
          animationDuration: 700,
          animationDelay: 200,
          animationFillMode: 'forwards',
          animationTimingFunction: 'ease-out',
        }}>
        <View style={styles.iconRow}>
          <WeatherIcon condition={current.condition} isDay={current.isDay} size={34} animated />
          <SkyText style={[Type.body, { color: Ink.secondary }]}>{current.summary}</SkyText>
        </View>

        <View style={styles.metaRow}>
          {today && (
            <SkyText style={[Type.bodySmall, { color: Ink.secondary }]}>
              H {Math.round(convertTemperature(today.temperatureMax, unit))}°  ·  L{' '}
              {Math.round(convertTemperature(today.temperatureMin, unit))}°
            </SkyText>
          )}
          <View style={styles.dot} />
          <SkyText style={[Type.bodySmall, { color: Ink.secondary }]}>
            Feels {formatTemperature(current.feelsLike, unit)}
          </SkyText>
        </View>

        <SkyText style={[Type.caption, { color: Ink.quaternary }]}>
          {yesterdayComparison ?? conditionTagline(current.condition, current.precipitation > 0 ? 70 : 20)}
        </SkyText>
      </Animated.View>
    </Animated.View>
  );
});

/** Condenses in as the hero dissolves; shares the same scroll value. */
export const CompactHeader = memo(function CompactHeader({
  place,
  current,
  unit,
  scrollY,
  topInset,
}: {
  place: Place;
  current: CurrentWeather;
  unit: TemperatureUnit;
  scrollY: SharedValue<number>;
  topInset: number;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HANDOFF * 0.55, HANDOFF], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [HANDOFF * 0.55, HANDOFF], [-12, 0], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <Animated.View
      style={[styles.compact, { paddingTop: topInset + 6 }, animatedStyle, { pointerEvents: 'none' }]}>
      <View style={styles.compactInner}>
        <WeatherIcon condition={current.condition} isDay={current.isDay} size={26} />
        <SkyText style={[Type.heading, { flexShrink: 1 }]} numberOfLines={1}>
          {place.name}
        </SkyText>
        <SkyText style={[Type.heading, { color: Ink.secondary }]}>
          {formatTemperature(current.temperature, unit)}
        </SkyText>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: Space.lg,
    paddingBottom: Space.xl,
    gap: Space.xs,
  },
  place: {
    textAlign: 'center',
  },
  tempRow: {
    marginTop: -Space.xs,
  },
  temp: {
    // Optical alignment: the hairline glyphs read left-heavy without this.
    marginLeft: 14,
  },
  unitStack: {
    marginTop: 18,
    alignItems: 'flex-start',
  },
  degree: {
    fontSize: 40,
    fontWeight: '200',
    lineHeight: 44,
  },
  unit: {
    color: Ink.tertiary,
    marginTop: -4,
    marginLeft: 2,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Ink.quaternary,
  },
  compact: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: Space.xs,
    paddingHorizontal: Space.lg,
    zIndex: 10,
  },
  compactInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.xs,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.18)',
    paddingVertical: Space.xs,
    paddingHorizontal: Space.md,
    alignSelf: 'center',
  },
});
