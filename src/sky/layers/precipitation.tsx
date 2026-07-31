import { memo, useMemo } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { createRng, range } from '@/lib/rng';
import { FILL, lerp, scaleCount, windShear, withAlpha, type LayerProps } from './shared';

/**
 * Falling-particle layers: rain, snow, sleet and hail.
 *
 * Every particle is a plain `Animated.View` driven by a Reanimated **CSS
 * keyframe animation**, which is evaluated natively. That matters: with 150+
 * raindrops on screen, a `useAnimatedStyle` per drop would mean 150 worklet
 * evaluations per frame, whereas keyframes cost zero JS once mounted.
 *
 * Particles are phase-distributed with a *negative* `animationDelay` — CSS
 * semantics for "start this animation partway through" — so the field is full
 * on the very first frame instead of filling in over one cycle.
 */

/** Rain */
export const RainLayer = memo(function RainLayer({
  width,
  height,
  state,
  palette,
  quality,
  motion,
}: LayerProps) {
  const drops = useMemo(() => {
    const count = scaleCount(lerp(45, 165, state.intensity), quality);
    const rng = createRng(state.seed ^ 0x5241_494e);
    const { degrees, driftX } = windShear(state.windSpeed, height);

    return Array.from({ length: count }, (_, i) => {
      // Depth: near drops are longer, faster, more opaque. Cheap parallax.
      const depth = rng();
      const length = lerp(9, 30, depth) * lerp(0.8, 1.35, state.intensity);
      const duration = lerp(1150, 420, depth) / lerp(0.85, 1.3, state.intensity);

      return {
        key: `drop-${i}`,
        left: range(rng, -0.12, 1.12) * width,
        width: lerp(0.9, 2.1, depth),
        height: length,
        opacity: lerp(0.16, 0.62, depth),
        duration,
        delay: -rng() * duration,
        degrees,
        driftX,
      };
    });
  }, [width, height, state.seed, state.intensity, state.windSpeed, quality]);

  const tint = withAlpha(palette.particle, 0.9);

  return (
    <View style={FILL}>
      {drops.map((drop) => (
        <Animated.View
          key={drop.key}
          style={{
            position: 'absolute',
            left: drop.left,
            top: 0,
            width: drop.width,
            height: drop.height,
            borderRadius: drop.width,
            backgroundColor: tint,
            opacity: drop.opacity,
            transform: [{ translateY: -40 }, { rotate: `${drop.degrees}deg` }],
            ...(motion
              ? {
                  animationName: {
                    from: {
                      transform: [
                        { translateX: 0 },
                        { translateY: -drop.height - 40 },
                        { rotate: `${drop.degrees}deg` },
                      ],
                    },
                    to: {
                      transform: [
                        { translateX: drop.driftX },
                        { translateY: height + 40 },
                        { rotate: `${drop.degrees}deg` },
                      ],
                    },
                  },
                  animationDuration: drop.duration,
                  animationDelay: drop.delay,
                  animationIterationCount: 'infinite' as const,
                  animationTimingFunction: 'linear' as const,
                }
              : null),
          }}
        />
      ))}
    </View>
  );
});

/** Snow — flakes sway horizontally as they fall, and tumble as they go. */
export const SnowLayer = memo(function SnowLayer({
  width,
  height,
  state,
  palette,
  quality,
  motion,
}: LayerProps) {
  const flakes = useMemo(() => {
    const count = scaleCount(lerp(35, 120, state.intensity), quality);
    const rng = createRng(state.seed ^ 0x534e_4f57);
    const { driftX } = windShear(state.windSpeed, height, 18);

    return Array.from({ length: count }, (_, i) => {
      const depth = rng();
      const size = lerp(2, 8, depth);
      const duration = lerp(16000, 6500, depth) / lerp(0.9, 1.25, state.intensity);
      const sway = lerp(14, 46, rng());
      const spin = rng() > 0.5 ? 360 : -360;

      return {
        key: `flake-${i}`,
        left: range(rng, -0.1, 1.1) * width,
        size,
        opacity: lerp(0.3, 0.95, depth),
        duration,
        delay: -rng() * duration,
        sway,
        spin,
        driftX,
      };
    });
  }, [width, height, state.seed, state.intensity, state.windSpeed, quality]);

  const tint = withAlpha(palette.particle, 0.95);

  return (
    <View style={FILL}>
      {flakes.map((flake) => (
        <Animated.View
          key={flake.key}
          style={{
            position: 'absolute',
            left: flake.left,
            top: 0,
            width: flake.size,
            height: flake.size,
            borderRadius: flake.size,
            backgroundColor: tint,
            opacity: flake.opacity,
            transform: [{ translateY: -20 }],
            ...(motion
              ? {
                  // Four intermediate stops trace a gentle S-curve, so flakes
                  // drift side to side instead of dropping on rails.
                  animationName: {
                    '0%': {
                      transform: [
                        { translateX: 0 },
                        { translateY: -flake.size - 20 },
                        { rotate: '0deg' },
                      ],
                    },
                    '25%': {
                      transform: [
                        { translateX: flake.sway + flake.driftX * 0.25 },
                        { translateY: height * 0.25 },
                        { rotate: `${flake.spin * 0.25}deg` },
                      ],
                    },
                    '50%': {
                      transform: [
                        { translateX: flake.driftX * 0.5 },
                        { translateY: height * 0.5 },
                        { rotate: `${flake.spin * 0.5}deg` },
                      ],
                    },
                    '75%': {
                      transform: [
                        { translateX: -flake.sway + flake.driftX * 0.75 },
                        { translateY: height * 0.75 },
                        { rotate: `${flake.spin * 0.75}deg` },
                      ],
                    },
                    '100%': {
                      transform: [
                        { translateX: flake.driftX },
                        { translateY: height + 20 },
                        { rotate: `${flake.spin}deg` },
                      ],
                    },
                  },
                  animationDuration: flake.duration,
                  animationDelay: flake.delay,
                  animationIterationCount: 'infinite' as const,
                  animationTimingFunction: 'linear' as const,
                }
              : null),
          }}
        />
      ))}
    </View>
  );
});

/** Sleet — rain streaks interleaved with half-melted flakes. */
export const SleetLayer = memo(function SleetLayer(props: LayerProps) {
  const rainProps = { ...props, state: { ...props.state, intensity: props.state.intensity * 0.7 } };
  const snowProps = {
    ...props,
    state: { ...props.state, intensity: props.state.intensity * 0.45, seed: props.state.seed ^ 0x1234 },
  };

  return (
    <>
      <RainLayer {...rainProps} />
      <SnowLayer {...snowProps} />
    </>
  );
});

/** Hail — small, fast, near-vertical, and noticeably brighter than rain. */
export const HailLayer = memo(function HailLayer({
  width,
  height,
  state,
  palette,
  quality,
  motion,
}: LayerProps) {
  const stones = useMemo(() => {
    const count = scaleCount(lerp(30, 90, state.intensity), quality);
    const rng = createRng(state.seed ^ 0x4841_494c);
    // Hail is heavy: it barely deflects in wind.
    const { driftX } = windShear(state.windSpeed * 0.35, height, 10);

    return Array.from({ length: count }, (_, i) => {
      const depth = rng();
      const size = lerp(3, 9, depth);
      const duration = lerp(900, 420, depth);

      return {
        key: `hail-${i}`,
        left: range(rng, -0.05, 1.05) * width,
        size,
        opacity: lerp(0.45, 1, depth),
        duration,
        delay: -rng() * duration,
        driftX,
      };
    });
  }, [width, height, state.seed, state.intensity, state.windSpeed, quality]);

  return (
    <View style={FILL}>
      {stones.map((stone) => (
        <Animated.View
          key={stone.key}
          style={{
            position: 'absolute',
            left: stone.left,
            top: 0,
            width: stone.size,
            height: stone.size * 1.15,
            borderRadius: stone.size,
            backgroundColor: withAlpha(palette.particle, 0.95),
            borderWidth: 0.5,
            borderColor: withAlpha('#FFFFFF', 0.7),
            opacity: stone.opacity,
            transform: [{ translateY: -20 }],
            ...(motion
              ? {
                  animationName: {
                    from: { transform: [{ translateX: 0 }, { translateY: -stone.size - 20 }] },
                    to: { transform: [{ translateX: stone.driftX }, { translateY: height + 20 }] },
                  },
                  animationDuration: stone.duration,
                  animationDelay: stone.delay,
                  animationIterationCount: 'infinite' as const,
                  animationTimingFunction: 'linear' as const,
                }
              : null),
          }}
        />
      ))}
    </View>
  );
});
