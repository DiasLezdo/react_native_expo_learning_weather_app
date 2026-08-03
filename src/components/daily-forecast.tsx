import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Ink, Radius, Space, temperatureColor, Type } from '@/design/tokens';
import { convertTemperature, formatWeekday, isSameLocalDay } from '@/weather/format';
import type { DailyForecast, TemperatureUnit } from '@/weather/types';
import { SkyText } from './ui/sky-text';
import { WeatherIcon } from './weather-icon';

/**
 * Ten-day outlook.
 *
 * Every row's bar is drawn on the same temperature scale, so a cold snap on
 * Thursday is visible as a bar that sits further left — the week's shape is
 * legible without reading any numbers. Today's row also marks where the current
 * temperature sits inside its own range.
 */

export type DailyForecastListProps = {
  days: DailyForecast[];
  unit: TemperatureUnit;
  utcOffsetMinutes: number;
  currentTemperature: number;
  now?: number;
  /** Omit to render the rows as plain, non-interactive summaries. */
  onSelectDay?(day: DailyForecast): void;
};

export const DailyForecastList = memo(function DailyForecastList({
  days,
  unit,
  utcOffsetMinutes,
  currentTemperature,
  now = Date.now(),
  onSelectDay,
}: DailyForecastListProps) {
  // One shared scale across every row is the whole point of the component.
  const scale = useMemo(() => {
    if (!days.length) return { min: 0, span: 1 };
    const min = Math.min(...days.map((d) => d.temperatureMin));
    const max = Math.max(...days.map((d) => d.temperatureMax));
    return { min, span: Math.max(1, max - min) };
  }, [days]);

  const handleSelect = useCallback(
    (day: DailyForecast) => {
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelectDay?.(day);
    },
    [onSelectDay],
  );

  return (
    <View>
      {days.map((day, index) => {
        const isToday = isSameLocalDay(day.date, now, utcOffsetMinutes);
        const left = ((day.temperatureMin - scale.min) / scale.span) * 100;
        const width = ((day.temperatureMax - day.temperatureMin) / scale.span) * 100;

        const nowLeft = isToday
          ? Math.min(
              100,
              Math.max(0, ((currentTemperature - scale.min) / scale.span) * 100),
            )
          : null;

        return (
          <Animated.View
            key={day.date}
            style={{
              opacity: 0,
              animationName: {
                from: { opacity: 0, transform: [{ translateX: 18 }] },
                to: { opacity: 1, transform: [{ translateX: 0 }] },
              },
              animationDuration: 520,
              animationDelay: 120 + index * 55,
              animationFillMode: 'forwards',
              animationTimingFunction: 'ease-out',
            }}>
          <Pressable
            onPress={onSelectDay ? () => handleSelect(day) : undefined}
            disabled={!onSelectDay}
            accessibilityRole={onSelectDay ? 'button' : undefined}
            accessibilityLabel={
              onSelectDay
                ? `${isToday ? 'Today' : formatWeekday(day.date, utcOffsetMinutes, true)}, high ${Math.round(
                    convertTemperature(day.temperatureMax, unit),
                  )} degrees, low ${Math.round(convertTemperature(day.temperatureMin, unit))} degrees`
                : undefined
            }
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <SkyText style={[Type.body, styles.day, isToday && styles.today]}>
              {isToday ? 'Today' : formatWeekday(day.date, utcOffsetMinutes)}
            </SkyText>

            <View style={styles.icon}>
              <WeatherIcon condition={day.condition} size={26} />
            </View>

            <View style={styles.precip}>
              {day.precipitationChance >= 20 && (
                <SkyText style={[Type.caption, { color: '#7FD2FF', fontSize: 11 }]}>
                  {day.precipitationChance}%
                </SkyText>
              )}
            </View>

            <SkyText style={[Type.bodySmall, styles.low]}>
              {Math.round(convertTemperature(day.temperatureMin, unit))}°
            </SkyText>

            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { left: `${left}%`, width: `${Math.max(width, 6)}%` },
                ]}>
                <LinearGradient
                  colors={[temperatureColor(day.temperatureMin), temperatureColor(day.temperatureMax)]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>

              {nowLeft !== null && (
                <View style={[styles.nowDot, { left: `${nowLeft}%` }]} />
              )}
            </View>

            <SkyText style={[Type.bodySmall, styles.high]}>
              {Math.round(convertTemperature(day.temperatureMax, unit))}°
            </SkyText>

            {onSelectDay && (
              <Svg width={12} height={12} viewBox="0 0 24 24" style={styles.chevron}>
                <Path
                  d="M9 5 L16 12 L9 19"
                  stroke={Ink.quaternary}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </Svg>
            )}
          </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.md,
    paddingVertical: 9,
    gap: Space.xs,
  },
  rowPressed: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chevron: {
    marginLeft: -Space.xxs,
  },
  day: {
    width: 58,
    color: Ink.primary,
  },
  today: {
    fontWeight: '700',
  },
  icon: {
    width: 30,
    alignItems: 'center',
  },
  precip: {
    width: 32,
    alignItems: 'flex-start',
  },
  low: {
    width: 32,
    textAlign: 'right',
    color: Ink.tertiary,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginHorizontal: Space.xs,
    overflow: 'visible',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    height: 6,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  nowDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(10,20,40,0.5)',
  },
  high: {
    width: 34,
    textAlign: 'right',
    color: Ink.primary,
    fontWeight: '700',
  },
});
