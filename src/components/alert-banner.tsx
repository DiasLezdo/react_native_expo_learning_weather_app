import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Ink, Radius, Space, Type } from '@/design/tokens';
import { formatRelative } from '@/weather/format';
import type { WeatherAlert } from '@/weather/types';
import { SkyText } from './ui/sky-text';

/**
 * Severe-weather banner.
 *
 * The only element in the app permitted to use colour outside the sky palette:
 * a warning has to survive being shown against a storm sky that is already
 * flashing, so it gets its own gradient and a slow pulse on the edge.
 */

const SEVERITY: Record<WeatherAlert['severity'], { colors: [string, string]; label: string }> = {
  advisory: { colors: ['#3D7BC4', '#2A5A96'], label: 'Advisory' },
  watch: { colors: ['#C4922A', '#966B1E'], label: 'Watch' },
  warning: { colors: ['#C4562A', '#96371E'], label: 'Warning' },
  emergency: { colors: ['#C42A4A', '#8C1230'], label: 'Emergency' },
};

export const AlertBanner = memo(function AlertBanner({
  alert,
  index,
}: {
  alert: WeatherAlert;
  index?: number;
}) {
  const severity = SEVERITY[alert.severity];

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: 0,
          animationName: {
            from: { opacity: 0, transform: [{ translateY: 16 }] },
            to: { opacity: 1, transform: [{ translateY: 0 }] },
          },
          animationDuration: 600,
          animationDelay: Math.min((index ?? 0) * 70, 400),
          animationFillMode: 'forwards',
          animationTimingFunction: 'ease-out',
        },
      ]}>
      <LinearGradient
        colors={severity.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Breathing edge — draws the eye without animating the whole card. */}
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: Radius.lg,
          borderWidth: 1.5,
          borderColor: 'rgba(255,255,255,0.5)',
          animationName: {
            '0%': { opacity: 0.25 },
            '50%': { opacity: 0.8 },
            '100%': { opacity: 0.25 },
          },
          animationDuration: 2400,
          animationIterationCount: 'infinite',
          animationTimingFunction: 'ease-in-out',
          pointerEvents: 'none',
        }}
      />

      <View style={styles.row}>
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path
            d="M12 3 L22 20 H2 Z"
            fill="rgba(255,255,255,0.22)"
            stroke="#FFFFFF"
            strokeWidth={1.8}
            strokeLinejoin="round"
          />
          <Path d="M12 9 V14" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
          <Path d="M12 17 V17.2" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" />
        </Svg>

        <View style={styles.text}>
          <SkyText style={[Type.label, { color: 'rgba(255,255,255,0.75)' }]}>
            {severity.label.toUpperCase()} · ENDS {formatRelative(alert.endsAt).toUpperCase()}
          </SkyText>
          <SkyText style={Type.heading}>{alert.title}</SkyText>
          <SkyText style={[Type.bodySmall, { color: Ink.secondary }]}>{alert.description}</SkyText>
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: Space.sm,
    padding: Space.md,
  },
  text: {
    flex: 1,
    gap: 3,
  },
});
