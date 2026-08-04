import { memo, useId, useMemo } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

import { createRng, range } from '@/lib/rng';
import { FILL, lerp, scaleCount, type LayerProps } from './shared';

/**
 * Aurora.
 *
 * Curtains, not clouds: real aurora hangs in vertical folds that are brightest
 * along their lower edge, where the emission is densest, and fade upward into
 * nothing. Each curtain here is a closed path whose left and right edges are
 * independent sine waves, filled with a vertical gradient — so the shape ripples
 * while the fill keeps the glow anchored to the bottom.
 *
 * The palette is the real one: oxygen green at low altitude, with nitrogen's
 * violet-magenta above it. Getting those two the wrong way round is the thing
 * that makes drawn aurora look invented.
 */

const GREEN = '#4AE39A';
const CYAN = '#35D0FF';
const VIOLET = '#B07CFF';

/**
 * One curtain, as an SVG path.
 *
 * Sampled top to bottom down the left edge, then back up the right, so the
 * ribbon can vary in width along its length rather than being a rigid band.
 */
function curtainPath(
  width: number,
  height: number,
  centre: number,
  halfWidth: number,
  waves: number,
  phase: number,
  skew: number,
) {
  const steps = 14;
  const left: string[] = [];
  const right: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * height;
    // Wander sideways with depth, so curtains lean rather than hang plumb.
    const drift = Math.sin(t * Math.PI * waves + phase) * width * 0.06 + t * skew;
    // Pinch toward the top: the fold narrows as it climbs.
    const w = halfWidth * lerp(0.35, 1, t);

    left.push(`${(centre + drift - w).toFixed(1)} ${y.toFixed(1)}`);
    right.unshift(`${(centre + drift + w).toFixed(1)} ${y.toFixed(1)}`);
  }

  return `M ${left[0]} L ${left.slice(1).join(' L ')} L ${right.join(' L ')} Z`;
}

export const AuroraLayer = memo(function AuroraLayer({
  width,
  height,
  state,
  quality,
  motion,
}: LayerProps) {
  const uid = `aur${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const curtains = useMemo(() => {
    const count = scaleCount(4, Math.max(quality, 0.5));
    const rng = createRng(state.seed ^ 0x4155_524f);
    // Aurora sits over the upper sky; the band is taller than it looks because
    // the gradient dissolves most of the top.
    const bandHeight = height * 0.62;

    return Array.from({ length: count }, (_, i) => {
      const duration = range(rng, 14_000, 26_000);
      return {
        key: `curtain-${i}`,
        d: curtainPath(
          width,
          bandHeight,
          range(rng, 0.1, 0.9) * width,
          range(rng, 0.06, 0.17) * width,
          range(rng, 1.2, 2.6),
          range(rng, 0, Math.PI * 2),
          range(rng, -40, 40),
        ),
        height: bandHeight,
        opacity: range(rng, 0.3, 0.72),
        duration,
        delay: -rng() * duration,
        drift: range(rng, -26, 26),
        // Curtains higher in the mix get more violet.
        violet: rng() > 0.55,
      };
    });
  }, [width, height, state.seed, quality]);

  return (
    <View style={FILL}>
      {curtains.map((curtain) => (
        <Animated.View
          key={curtain.key}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width,
            height: curtain.height,
            opacity: curtain.opacity,
            ...(motion
              ? {
                  // Curtains breathe and slide; they never simply blink.
                  animationName: {
                    '0%': { transform: [{ translateX: -curtain.drift }, { scaleY: 0.94 }], opacity: curtain.opacity * 0.5 },
                    '50%': { transform: [{ translateX: curtain.drift }, { scaleY: 1.06 }], opacity: curtain.opacity },
                    '100%': { transform: [{ translateX: -curtain.drift }, { scaleY: 0.94 }], opacity: curtain.opacity * 0.5 },
                  },
                  animationDuration: curtain.duration,
                  animationDelay: curtain.delay,
                  animationIterationCount: 'infinite' as const,
                  animationTimingFunction: 'ease-in-out' as const,
                }
              : null),
          }}>
          <Svg width={width} height={curtain.height}>
            <Defs>
              {/*
               * Vertical, and the direction matters: transparent at the top,
               * brightest along the bottom edge. Inverting this reads as a
               * coloured smear rather than as light hanging in the sky.
               */}
              <SvgLinearGradient id={`${uid}${curtain.key}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={curtain.violet ? VIOLET : CYAN} stopOpacity={0} />
                <Stop offset="0.35" stopColor={curtain.violet ? VIOLET : CYAN} stopOpacity={0.22} />
                <Stop offset="0.7" stopColor={GREEN} stopOpacity={0.55} />
                <Stop offset="0.92" stopColor={GREEN} stopOpacity={0.8} />
                <Stop offset="1" stopColor={GREEN} stopOpacity={0} />
              </SvgLinearGradient>
            </Defs>
            <Path d={curtain.d} fill={`url(#${uid}${curtain.key})`} />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
});
