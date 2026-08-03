import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Ink, Space } from '@/design/tokens';

/**
 * Which city you are on, and how many there are.
 *
 * Driven by the pager's fractional scroll position rather than the settled
 * index, so the dots stretch and fade continuously under the finger instead of
 * snapping when the page commits.
 */

const DOT = 6;
const ACTIVE_WIDTH = 18;

const Dot = memo(function Dot({
  index,
  progress,
  isLocation,
}: {
  index: number;
  progress: SharedValue<number>;
  isLocation: boolean;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(progress.value - index);
    return {
      width: interpolate(distance, [0, 1], [ACTIVE_WIDTH, DOT], Extrapolation.CLAMP),
      opacity: interpolate(distance, [0, 1], [1, 0.38], Extrapolation.CLAMP),
    };
  });

  // The device-location page gets an arrow instead of a dot, so "where I am"
  // is identifiable without swiping to it.
  if (isLocation) {
    return (
      <Animated.View style={[styles.locationDot, animatedStyle]}>
        <Svg width={11} height={11} viewBox="0 0 24 24">
          <Path d="M21 3 L3 10.5 L11 13 L13.5 21 Z" fill={Ink.primary} />
        </Svg>
      </Animated.View>
    );
  }

  return <Animated.View style={[styles.dot, animatedStyle]} />;
});

export const PageDots = memo(function PageDots({
  count,
  progress,
  locationIndex,
  bottom,
}: {
  count: number;
  progress: SharedValue<number>;
  /** Index of the "Current Location" page, or -1. */
  locationIndex: number;
  bottom: number;
}) {
  if (count <= 1) return null;

  return (
    <View style={[styles.wrap, { bottom, pointerEvents: 'none' }]}>
      {Array.from({ length: count }, (_, index) => (
        <Dot key={index} index={index} progress={progress} isLocation={index === locationIndex} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.xs,
  },
  dot: {
    height: DOT,
    borderRadius: DOT,
    backgroundColor: Ink.primary,
  },
  locationDot: {
    height: DOT * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
