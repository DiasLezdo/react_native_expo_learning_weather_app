import { memo, useEffect, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { Ink, Space, temperatureColor, Type } from '@/design/tokens';
import { convertTemperature, formatHour } from '@/weather/format';
import type { HourlyForecast, TemperatureUnit } from '@/weather/types';
import { SkyText } from './ui/sky-text';
import { WeatherIcon } from './weather-icon';

/**
 * Hourly forecast as a continuous ribbon.
 *
 * Rather than 24 disconnected tiles, the temperatures are drawn as one smooth
 * curve that the hours ride along — so the *shape* of the day is readable at a
 * glance before a single number is. The curve draws itself in on mount by
 * animating `strokeDashoffset`, which is a single animated prop rather than 24
 * animated views.
 */

const COL_WIDTH = 66;
const CURVE_HEIGHT = 92;
const CURVE_PAD = 22;
const HOURS_SHOWN = 24;

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Catmull-Rom through the points, converted to cubic Béziers.
 *
 * A polyline would make the day look like a stock chart; interpolating gives
 * the soft arc that real temperature actually follows.
 */
function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return '';

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    // Tension 1/6 keeps the curve tight to its points without overshooting.
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/** Chord-length estimate — close enough to seed a dash-offset reveal. */
function approximateLength(points: { x: number; y: number }[]) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  // Curves run slightly longer than their chords.
  return total * 1.08;
}

export type HourlyRibbonProps = {
  hours: HourlyForecast[];
  unit: TemperatureUnit;
  utcOffsetMinutes: number;
  use24Hour: boolean;
};

export const HourlyRibbon = memo(function HourlyRibbon({
  hours,
  unit,
  utcOffsetMinutes,
  use24Hour,
}: HourlyRibbonProps) {
  const data = useMemo(() => hours.slice(0, HOURS_SHOWN), [hours]);

  const geometry = useMemo(() => {
    if (!data.length) return null;

    const temps = data.map((h) => h.temperature);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    // Flat days would otherwise divide by zero and pin every point to one line.
    const span = Math.max(1.5, max - min);

    const points = data.map((hour, i) => ({
      x: i * COL_WIDTH + COL_WIDTH / 2,
      y: CURVE_PAD + (1 - (hour.temperature - min) / span) * (CURVE_HEIGHT - CURVE_PAD * 2),
    }));

    return {
      points,
      path: smoothPath(points),
      // Close the path down to the baseline to fill the area beneath it.
      area: `${smoothPath(points)} L ${points[points.length - 1].x} ${CURVE_HEIGHT} L ${points[0].x} ${CURVE_HEIGHT} Z`,
      length: approximateLength(points),
      width: data.length * COL_WIDTH,
    };
  }, [data]);

  const draw = useSharedValue(0);

  useEffect(() => {
    draw.value = 0;
    draw.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [geometry, draw]);

  const pathProps = useAnimatedProps(() => ({
    strokeDashoffset: (geometry?.length ?? 0) * (1 - draw.value),
  }));

  if (!geometry) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: Space.md }}
      // The ribbon is one wide flat row; clipping and removing offscreen
      // subviews costs more than it saves here.
      removeClippedSubviews={false}>
      <View style={{ width: geometry.width }}>
        <View style={styles.row}>
          {data.map((hour, i) => (
            <View key={hour.time} style={styles.column}>
              <SkyText style={[Type.caption, styles.hourLabel, i === 0 && styles.nowLabel]}>
                {i === 0 ? 'NOW' : formatHour(hour.time, utcOffsetMinutes, use24Hour)}
              </SkyText>
              <WeatherIcon condition={hour.condition} isDay={hour.isDay} size={30} />
            </View>
          ))}
        </View>

        <Svg width={geometry.width} height={CURVE_HEIGHT}>
          <Defs>
            <SvgLinearGradient id="ribbonFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.28} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </SvgLinearGradient>
            <SvgLinearGradient id="ribbonStroke" x1="0" y1="0" x2="1" y2="0">
              {data.map((hour, i) => (
                <Stop
                  key={hour.time}
                  offset={data.length === 1 ? 0 : i / (data.length - 1)}
                  stopColor={temperatureColor(hour.temperature)}
                />
              ))}
            </SvgLinearGradient>
          </Defs>

          <Path d={geometry.area} fill="url(#ribbonFill)" />

          <AnimatedPath
            d={geometry.path}
            stroke="url(#ribbonStroke)"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={geometry.length}
            animatedProps={pathProps}
          />

          {geometry.points.map((point, i) => (
            <Circle
              key={data[i].time}
              cx={point.x}
              cy={point.y}
              r={i === 0 ? 5 : 3.2}
              fill={temperatureColor(data[i].temperature)}
              stroke="rgba(255,255,255,0.85)"
              strokeWidth={i === 0 ? 2.5 : 1.4}
            />
          ))}

          {geometry.points.map((point, i) => (
            <SvgText
              key={`label-${data[i].time}`}
              x={point.x}
              y={point.y - 12}
              fill="#FFFFFF"
              fontSize={14}
              fontWeight="600"
              textAnchor="middle">
              {`${Math.round(convertTemperature(data[i].temperature, unit))}°`}
            </SvgText>
          ))}
        </Svg>

        <View style={styles.row}>
          {data.map((hour) => (
            <View key={`precip-${hour.time}`} style={styles.column}>
              {hour.precipitationChance >= 15 ? (
                <View style={styles.precipWrap}>
                  <View style={styles.precipTrack}>
                    <View
                      style={[
                        styles.precipFill,
                        { height: `${Math.min(100, hour.precipitationChance)}%` },
                      ]}
                    />
                  </View>
                  <SkyText style={[Type.caption, { color: Ink.tertiary, fontSize: 10 }]}>
                    {hour.precipitationChance}%
                  </SkyText>
                </View>
              ) : (
                <View style={styles.precipWrap} />
              )}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  column: {
    width: COL_WIDTH,
    alignItems: 'center',
    gap: 6,
  },
  hourLabel: {
    color: Ink.secondary,
    letterSpacing: 0.6,
  },
  nowLabel: {
    color: Ink.primary,
    fontWeight: '800',
  },
  precipWrap: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
  },
  precipTrack: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  precipFill: {
    width: '100%',
    borderRadius: 2,
    backgroundColor: '#7FD2FF',
  },
});
