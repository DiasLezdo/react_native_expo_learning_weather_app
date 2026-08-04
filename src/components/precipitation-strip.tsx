import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Ink, Radius, Space, Type } from '@/design/tokens';
import {
  intensityLabel,
  minutelyHeadline,
  precipitationLabel,
  summariseMinutely,
} from '@/weather/minutely';
import type { MinutelyForecast, WeatherCondition } from '@/weather/types';
import { SkyText } from './ui/sky-text';

/**
 * The next hour, minute by minute.
 *
 * The bars are secondary. The headline is the feature: "Rain stopping in 12
 * minutes" is the one thing an hourly forecast structurally cannot tell you,
 * and it is usually the only reason to open a weather app at all.
 */

/** mm/h that fills a bar completely. Above this they simply cap. */
const FULL_SCALE = 6;
const BAR_HEIGHT = 46;

export type PrecipitationStripProps = {
  minutely: MinutelyForecast[];
  condition: WeatherCondition;
};

export const PrecipitationStrip = memo(function PrecipitationStrip({
  minutely,
  condition,
}: PrecipitationStripProps) {
  const label = precipitationLabel(condition);
  const summary = useMemo(() => summariseMinutely(minutely), [minutely]);
  const headline = minutelyHeadline(summary, label);

  // A marker at the moment things change, so the headline is locatable on the
  // chart rather than just asserted above it.
  const changeAt = summary.kind === 'stopping' || summary.kind === 'starting' ? summary.minutes : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headlineRow}>
        <SkyText style={Type.heading}>{headline}</SkyText>
        {summary.peak > 0 && (
          <SkyText style={[Type.caption, { color: Ink.tertiary }]}>
            {intensityLabel(summary.peak)} · peak {summary.peak.toFixed(1)} mm/h
          </SkyText>
        )}
      </View>

      <View style={styles.chart} accessible accessibilityLabel={headline}>
        {minutely.map((minute, index) => {
          const filled = Math.min(1, minute.intensity / FULL_SCALE);
          return (
            <Animated.View
              key={minute.time}
              style={[
                styles.column,
                {
                  // Zero-precipitation minutes keep a visible baseline, so the
                  // strip reads as a timeline rather than as missing data.
                  height: Math.max(2, filled * BAR_HEIGHT),
                  backgroundColor: filled > 0 ? '#7FD2FF' : 'rgba(255,255,255,0.14)',
                  opacity: 0,
                  animationName: {
                    from: { opacity: 0, transform: [{ scaleY: 0.2 }] },
                    to: { opacity: 1, transform: [{ scaleY: 1 }] },
                  },
                  animationDuration: 420,
                  animationDelay: Math.min(index * 6, 360),
                  animationFillMode: 'forwards',
                  animationTimingFunction: 'ease-out',
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.axis}>
        <SkyText style={styles.axisLabel}>NOW</SkyText>
        {changeAt !== null && changeAt > 6 && changeAt < 54 && (
          <SkyText style={[styles.axisLabel, styles.axisMarker, { left: `${(changeAt / 60) * 100}%` }]}>
            {changeAt}m
          </SkyText>
        )}
        <SkyText style={styles.axisLabel}>60 MIN</SkyText>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Space.md,
    gap: Space.xs,
  },
  headlineRow: {
    gap: 2,
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: BAR_HEIGHT,
    gap: 1.5,
    marginTop: Space.xxs,
  },
  column: {
    flex: 1,
    borderRadius: Radius.sm,
    minWidth: 1,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    ...Type.label,
    fontSize: 9,
    color: Ink.quaternary,
  },
  axisMarker: {
    position: 'absolute',
    color: '#7FD2FF',
    marginLeft: -8,
  },
});
