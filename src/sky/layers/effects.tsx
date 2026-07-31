import { LinearGradient } from 'expo-linear-gradient';
import { memo, useId, useMemo, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';

import { createRng, range } from '@/lib/rng';
import { FILL, lerp, mixHex, scaleCount, STORM_PERIOD_MS, withAlpha, type LayerProps } from './shared';

/**
 * Atmospheric effects: lightning, heat shimmer, puddle ripples, wet glass,
 * city-light reflections, frost, gusts and dust.
 */

/* ------------------------------------------------------------------ *
 * Lightning
 * ------------------------------------------------------------------ */

/**
 * Two flash tracks with co-prime-ish periods (9s and 13s) drift in and out of
 * phase, so the storm never visibly loops even though neither track uses a
 * timer. Percentages are tight because real lightning is a 100ms event.
 */
const FLASH_KEYFRAMES_A = {
  '0%': { opacity: 0 },
  '1.1%': { opacity: 0.55 },
  '1.9%': { opacity: 0.08 },
  '2.6%': { opacity: 0.8 },
  '4.2%': { opacity: 0 },
  '100%': { opacity: 0 },
} as const;

const FLASH_KEYFRAMES_B = {
  '0%': { opacity: 0 },
  '52%': { opacity: 0 },
  '53%': { opacity: 0.42 },
  '55%': { opacity: 0.05 },
  '56.2%': { opacity: 0.3 },
  '58%': { opacity: 0 },
  '100%': { opacity: 0 },
} as const;

/** Jagged bolt path, generated once per seed. */
function boltPath(rng: () => number, height: number) {
  const segments = 7;
  let x = 50;
  let d = `M ${x} 0`;

  for (let i = 1; i <= segments; i++) {
    const y = (i / segments) * height;
    x += range(rng, -16, 16);
    d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    // Forked branch partway down.
    if (i === 4) {
      d += ` M ${x.toFixed(1)} ${y.toFixed(1)} L ${(x + range(rng, 12, 26)).toFixed(1)} ${(
        y +
        height * 0.22
      ).toFixed(1)}`;
      d += ` M ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  return d;
}

export const LightningLayer = memo(function LightningLayer({
  width,
  height,
  state,
  palette,
  motion,
}: LayerProps) {
  const bolts = useMemo(() => {
    const rng = createRng(state.seed ^ 0x424f_4c54);
    const boltHeight = height * 0.55;

    return [
      { key: 'bolt-a', left: width * range(rng, 0.12, 0.4), d: boltPath(rng, 100), height: boltHeight, track: 'a' as const },
      { key: 'bolt-b', left: width * range(rng, 0.55, 0.82), d: boltPath(rng, 100), height: boltHeight * 0.8, track: 'b' as const },
    ];
  }, [width, height, state.seed]);

  if (!motion) return null;

  return (
    <View style={FILL}>
      {/* Sky-wide illumination, brightest at the top where the cell sits. */}
      <Animated.View
        style={{
          ...FILL,
          animationName: FLASH_KEYFRAMES_A,
          animationDuration: STORM_PERIOD_MS,
          animationIterationCount: 'infinite',
          animationTimingFunction: 'linear',
        }}>
        <LinearGradient
          colors={[withAlpha('#FFFFFF', 0.95), withAlpha(palette.accent, 0.5), withAlpha('#FFFFFF', 0)]}
          locations={[0, 0.35, 1]}
          style={{ flex: 1 }}
        />
      </Animated.View>

      <Animated.View
        style={{
          ...FILL,
          animationName: FLASH_KEYFRAMES_B,
          animationDuration: STORM_PERIOD_MS * 1.444,
          animationIterationCount: 'infinite',
          animationTimingFunction: 'linear',
        }}>
        <LinearGradient
          colors={[withAlpha(palette.accent, 0.8), withAlpha('#FFFFFF', 0.3), withAlpha('#FFFFFF', 0)]}
          locations={[0, 0.4, 1]}
          style={{ flex: 1 }}
        />
      </Animated.View>

      {bolts.map((bolt) => (
        <Animated.View
          key={bolt.key}
          style={{
            position: 'absolute',
            left: bolt.left,
            top: 0,
            width: 110,
            height: bolt.height,
            opacity: 0,
            animationName: bolt.track === 'a' ? FLASH_KEYFRAMES_A : FLASH_KEYFRAMES_B,
            animationDuration: bolt.track === 'a' ? STORM_PERIOD_MS : STORM_PERIOD_MS * 1.444,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'linear',
          }}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Path d={bolt.d} stroke={withAlpha('#FFFFFF', 0.9)} strokeWidth={2.6} fill="none" />
            <Path d={bolt.d} stroke={withAlpha(palette.accent, 0.85)} strokeWidth={1.1} fill="none" />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
});

/**
 * Whole-screen rumble, synchronised to the lightning tracks by construction —
 * both read `STORM_PERIOD_MS`, so no JS timer has to keep them together.
 * Displacement is kept to ~2px: enough to feel, not enough to smear text.
 */
const OVERSCAN = 1.012;

export const StormRumble = memo(function StormRumble({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  if (!active) return <>{children}</>;

  return (
    <Animated.View
      style={{
        flex: 1,
        // Held at a constant 1.012 overscan: without it the ~2px displacement
        // would drag the full-bleed sky off its own edge and flash the root
        // background. The scale never changes, so nothing visibly zooms.
        transform: [{ scale: OVERSCAN }],
        animationName: {
          '0%': { transform: [{ translateY: 0 }, { translateX: 0 }, { scale: OVERSCAN }] },
          '2.4%': { transform: [{ translateY: 1.8 }, { translateX: -1.2 }, { scale: OVERSCAN }] },
          '3.0%': { transform: [{ translateY: -1.6 }, { translateX: 1.4 }, { scale: OVERSCAN }] },
          '3.6%': { transform: [{ translateY: 1.2 }, { translateX: 0.8 }, { scale: OVERSCAN }] },
          '4.4%': { transform: [{ translateY: -0.6 }, { translateX: -0.5 }, { scale: OVERSCAN }] },
          '5.4%': { transform: [{ translateY: 0 }, { translateX: 0 }, { scale: OVERSCAN }] },
          '100%': { transform: [{ translateY: 0 }, { translateX: 0 }, { scale: OVERSCAN }] },
        },
        animationDuration: STORM_PERIOD_MS,
        animationIterationCount: 'infinite',
        animationTimingFunction: 'linear',
      }}>
      {children}
    </Animated.View>
  );
});

/* ------------------------------------------------------------------ *
 * Heat shimmer
 * ------------------------------------------------------------------ */

/**
 * Rising heat.
 *
 * Previously this drew thin bands with a horizontal gradient — which faded at
 * the left and right ends but had hard top and bottom edges, so it rendered as
 * a stack of crisp horizontal lines across the sky rather than as haze. Each
 * band is now a very flat ellipse with a radial falloff, soft on every side,
 * and they sit low where heat haze actually forms instead of climbing halfway
 * up the sky.
 *
 * No shader means no true refraction, so this is deliberately near the
 * threshold of visibility: warmth that wavers, not an effect that announces
 * itself.
 */
export const ShimmerLayer = memo(function ShimmerLayer({
  width,
  height,
  state,
  palette,
  quality,
  motion,
}: LayerProps) {
  const uid = `shm${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // Pulled halfway to white: the raw accent is a saturated yellow, which reads
  // as a coloured line rather than as heat.
  const tint = mixHex(palette.accent, '#FFFFFF', 0.55);

  const bands = useMemo(() => {
    const count = scaleCount(5, Math.max(quality, 0.5));
    const rng = createRng(state.seed ^ 0x4845_4154);

    return Array.from({ length: count }, (_, i) => {
      const duration = range(rng, 3400, 6200);
      const bandHeight = range(rng, 26, 58);

      return {
        key: `shimmer-${i}`,
        // Confined to the bottom quarter: the band just above the ground.
        top: lerp(0.76, 0.99, count === 1 ? 0.5 : i / (count - 1)) * height + range(rng, -10, 10),
        height: bandHeight,
        width: width * 1.15,
        opacity: range(rng, 0.03, 0.075),
        duration,
        delay: -rng() * duration,
        stretch: range(rng, 1.25, 1.7),
      };
    });
  }, [width, height, state.seed, quality]);

  return (
    <View style={FILL}>
      {bands.map((band) => (
        <Animated.View
          key={band.key}
          style={{
            position: 'absolute',
            left: -(band.width - width) / 2,
            top: band.top,
            width: band.width,
            height: band.height,
            opacity: band.opacity,
            ...(motion
              ? {
                  animationName: {
                    '0%': { transform: [{ translateX: -14 }, { scaleY: 1 }] },
                    '50%': { transform: [{ translateX: 14 }, { scaleY: band.stretch }] },
                    '100%': { transform: [{ translateX: -14 }, { scaleY: 1 }] },
                  },
                  animationDuration: band.duration,
                  animationDelay: band.delay,
                  animationIterationCount: 'infinite' as const,
                  animationTimingFunction: 'ease-in-out' as const,
                }
              : null),
          }}>
          <Svg width={band.width} height={band.height}>
            <Defs>
              <RadialGradient id={`${uid}${band.key}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={tint} stopOpacity={0.9} />
                <Stop offset="0.45" stopColor={tint} stopOpacity={0.45} />
                <Stop offset="0.75" stopColor={tint} stopOpacity={0.14} />
                <Stop offset="1" stopColor={tint} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Ellipse
              cx={band.width / 2}
              cy={band.height / 2}
              rx={band.width / 2}
              ry={band.height / 2}
              fill={`url(#${uid}${band.key})`}
            />
          </Svg>
        </Animated.View>
      ))}
    </View>
  );
});

/* ------------------------------------------------------------------ *
 * Puddle ripples
 * ------------------------------------------------------------------ */

/** Expanding rings along the bottom, as if rain were hitting standing water. */
export const RippleLayer = memo(function RippleLayer({
  width,
  height,
  state,
  palette,
  quality,
  motion,
}: LayerProps) {
  const ripples = useMemo(() => {
    const count = scaleCount(lerp(6, 18, state.intensity), quality);
    const rng = createRng(state.seed ^ 0x5249_5050);

    return Array.from({ length: count }, (_, i) => {
      const duration = range(rng, 1500, 3000);
      const size = range(rng, 26, 96);
      return {
        key: `ripple-${i}`,
        x: rng() * width,
        // Concentrated near the bottom, thinning upward for perspective.
        y: height * lerp(0.72, 1.0, Math.pow(rng(), 0.6)),
        size,
        duration,
        delay: -rng() * duration,
      };
    });
  }, [width, height, state.seed, state.intensity, quality]);

  if (!motion) return null;

  return (
    <View style={FILL}>
      {ripples.map((ripple) => (
        <Animated.View
          key={ripple.key}
          style={{
            position: 'absolute',
            left: ripple.x - ripple.size / 2,
            top: ripple.y - ripple.size / 8,
            width: ripple.size,
            // Squashed vertically so the ring reads as lying flat on a surface.
            height: ripple.size / 4,
            borderRadius: ripple.size,
            borderWidth: 1,
            borderColor: withAlpha(palette.particle, 0.55),
            opacity: 0,
            animationName: {
              '0%': { opacity: 0, transform: [{ scale: 0.12 }] },
              '18%': { opacity: 0.7 },
              '100%': { opacity: 0, transform: [{ scale: 1 }] },
            },
            animationDuration: ripple.duration,
            animationDelay: ripple.delay,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-out',
          }}
        />
      ))}
    </View>
  );
});

/* ------------------------------------------------------------------ *
 * Wet glass
 * ------------------------------------------------------------------ */

/**
 * Water on the "window" the app is viewed through: static beads that cling,
 * plus runners that slide down and reset.
 */
export const GlassDropsLayer = memo(function GlassDropsLayer({
  width,
  height,
  state,
  palette,
  quality,
  motion,
}: LayerProps) {
  const { beads, runners } = useMemo(() => {
    const rng = createRng(state.seed ^ 0x474c_4153);
    const beadCount = scaleCount(lerp(18, 52, state.intensity), quality);
    const runnerCount = scaleCount(lerp(3, 10, state.intensity), quality);

    return {
      beads: Array.from({ length: beadCount }, (_, i) => {
        const size = range(rng, 3, 13);
        const duration = range(rng, 3800, 9000);
        return {
          key: `bead-${i}`,
          x: rng() * width,
          y: rng() * height,
          size,
          opacity: range(rng, 0.1, 0.32),
          duration,
          delay: -rng() * duration,
        };
      }),
      runners: Array.from({ length: runnerCount }, (_, i) => {
        const duration = range(rng, 2600, 6500);
        const size = range(rng, 4, 9);
        return {
          key: `runner-${i}`,
          x: rng() * width,
          size,
          trail: range(rng, 40, 130),
          duration,
          delay: -rng() * duration,
        };
      }),
    };
  }, [width, height, state.seed, state.intensity, quality]);

  const glass = withAlpha(palette.particle, 0.55);

  return (
    <View style={FILL}>
      {beads.map((bead) => (
        <Animated.View
          key={bead.key}
          style={{
            position: 'absolute',
            left: bead.x,
            top: bead.y,
            width: bead.size,
            height: bead.size * 1.25,
            borderRadius: bead.size,
            backgroundColor: glass,
            borderWidth: 0.6,
            borderColor: withAlpha('#FFFFFF', 0.45),
            opacity: bead.opacity,
            ...(motion
              ? {
                  animationName: {
                    '0%': { opacity: bead.opacity * 0.5, transform: [{ scale: 0.9 }] },
                    '50%': { opacity: bead.opacity, transform: [{ scale: 1.08 }] },
                    '100%': { opacity: bead.opacity * 0.5, transform: [{ scale: 0.9 }] },
                  },
                  animationDuration: bead.duration,
                  animationDelay: bead.delay,
                  animationIterationCount: 'infinite' as const,
                  animationTimingFunction: 'ease-in-out' as const,
                }
              : null),
          }}
        />
      ))}

      {motion &&
        runners.map((runner) => (
          <Animated.View
            key={runner.key}
            style={{
              position: 'absolute',
              left: runner.x,
              top: 0,
              width: runner.size,
              height: runner.trail,
              borderRadius: runner.size,
              overflow: 'hidden',
              opacity: 0,
              animationName: {
                '0%': { opacity: 0, transform: [{ translateY: -runner.trail }] },
                '12%': { opacity: 0.5 },
                '88%': { opacity: 0.5 },
                '100%': { opacity: 0, transform: [{ translateY: height }] },
              },
              animationDuration: runner.duration,
              animationDelay: runner.delay,
              animationIterationCount: 'infinite',
              // Accelerating: a bead hesitates, then runs.
              animationTimingFunction: 'ease-in',
            }}>
            <LinearGradient
              colors={[withAlpha(palette.particle, 0), withAlpha(palette.particle, 0.75)]}
              style={{ flex: 1 }}
            />
          </Animated.View>
        ))}
    </View>
  );
});

/* ------------------------------------------------------------------ *
 * City lights
 * ------------------------------------------------------------------ */

/** Warm street glow and its wet vertical reflections — night rain only. */
export const CityLightsLayer = memo(function CityLightsLayer({
  width,
  height,
  state,
  quality,
  motion,
}: LayerProps) {
  const lights = useMemo(() => {
    const count = scaleCount(22, quality);
    const rng = createRng(state.seed ^ 0x4349_5459);
    const warm = ['#FFB65C', '#FF8A4C', '#FFD79A', '#6FD3FF', '#FF6B8A'];

    return Array.from({ length: count }, (_, i) => {
      const duration = range(rng, 2400, 6000);
      return {
        key: `light-${i}`,
        x: rng() * width,
        y: height * range(rng, 0.76, 0.99),
        size: range(rng, 3, 9),
        reflection: range(rng, 30, 110),
        color: warm[Math.floor(rng() * warm.length)],
        opacity: range(rng, 0.35, 0.9),
        duration,
        delay: -rng() * duration,
      };
    });
  }, [width, height, state.seed, quality]);

  return (
    <View style={FILL}>
      {lights.map((light) => (
        <View key={light.key} style={{ position: 'absolute', left: light.x, top: light.y }}>
          {/* Reflection smeared downward on wet ground. */}
          <Animated.View
            style={{
              position: 'absolute',
              left: -light.size / 2,
              top: light.size,
              width: light.size * 2,
              height: light.reflection,
              opacity: light.opacity * 0.5,
              ...(motion
                ? {
                    animationName: {
                      '0%': { transform: [{ scaleY: 0.85 }, { scaleX: 1 }] },
                      '50%': { transform: [{ scaleY: 1.15 }, { scaleX: 1.3 }] },
                      '100%': { transform: [{ scaleY: 0.85 }, { scaleX: 1 }] },
                    },
                    animationDuration: light.duration,
                    animationDelay: light.delay,
                    animationIterationCount: 'infinite' as const,
                    animationTimingFunction: 'ease-in-out' as const,
                  }
                : null),
            }}>
            <LinearGradient
              colors={[withAlpha(light.color, 0.7), withAlpha(light.color, 0)]}
              style={{ flex: 1, borderRadius: light.size }}
            />
          </Animated.View>

          {/* Glow halo. */}
          <View
            style={{
              position: 'absolute',
              left: -light.size * 1.5,
              top: -light.size * 1.5,
              width: light.size * 4,
              height: light.size * 4,
              borderRadius: light.size * 4,
              backgroundColor: withAlpha(light.color, 0.22),
            }}
          />
          <Animated.View
            style={{
              width: light.size,
              height: light.size,
              borderRadius: light.size,
              backgroundColor: light.color,
              opacity: light.opacity,
              ...(motion
                ? {
                    animationName: {
                      '0%': { opacity: light.opacity * 0.65 },
                      '50%': { opacity: light.opacity },
                      '100%': { opacity: light.opacity * 0.65 },
                    },
                    animationDuration: light.duration * 0.7,
                    animationDelay: light.delay,
                    animationIterationCount: 'infinite' as const,
                    animationTimingFunction: 'ease-in-out' as const,
                  }
                : null),
            }}
          />
        </View>
      ))}
    </View>
  );
});

/* ------------------------------------------------------------------ *
 * Frost
 * ------------------------------------------------------------------ */

/** Frozen edges plus glinting ice crystals. */
export const FrostLayer = memo(function FrostLayer({
  width,
  height,
  state,
  quality,
  motion,
}: LayerProps) {
  const crystals = useMemo(() => {
    const count = scaleCount(26, quality);
    const rng = createRng(state.seed ^ 0x4652_4f53);

    return Array.from({ length: count }, (_, i) => {
      const duration = range(rng, 2200, 5600);
      // Cluster toward the edges, where frost actually forms on glass.
      const edge = rng();
      const x = edge < 0.5 ? range(rng, 0, 0.22) * width : range(rng, 0.78, 1) * width;
      return {
        key: `crystal-${i}`,
        x,
        y: rng() * height,
        size: range(rng, 1.5, 4),
        duration,
        delay: -rng() * duration,
      };
    });
  }, [width, height, state.seed, quality]);

  return (
    <View style={FILL}>
      <LinearGradient
        colors={[withAlpha('#DCEBFA', 0.3), withAlpha('#DCEBFA', 0), withAlpha('#DCEBFA', 0.22)]}
        locations={[0, 0.42, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={FILL}
      />
      <LinearGradient
        colors={[withAlpha('#FFFFFF', 0.26), withAlpha('#FFFFFF', 0)]}
        locations={[0, 0.28]}
        style={FILL}
      />

      {crystals.map((crystal) => (
        <Animated.View
          key={crystal.key}
          style={{
            position: 'absolute',
            left: crystal.x,
            top: crystal.y,
            width: crystal.size,
            height: crystal.size,
            borderRadius: crystal.size,
            backgroundColor: '#FFFFFF',
            opacity: 0.5,
            ...(motion
              ? {
                  animationName: {
                    '0%': { opacity: 0.15, transform: [{ scale: 0.6 }] },
                    '50%': { opacity: 0.95, transform: [{ scale: 1.4 }] },
                    '100%': { opacity: 0.15, transform: [{ scale: 0.6 }] },
                  },
                  animationDuration: crystal.duration,
                  animationDelay: crystal.delay,
                  animationIterationCount: 'infinite' as const,
                  animationTimingFunction: 'ease-in-out' as const,
                }
              : null),
          }}
        />
      ))}
    </View>
  );
});

/* ------------------------------------------------------------------ *
 * Wind and dust
 * ------------------------------------------------------------------ */

/** Fast horizontal streaks that make wind visible. */
export const GustLayer = memo(function GustLayer({
  width,
  height,
  state,
  palette,
  quality,
  motion,
}: LayerProps) {
  const gusts = useMemo(() => {
    const count = scaleCount(14, quality);
    const rng = createRng(state.seed ^ 0x4755_5354);

    return Array.from({ length: count }, (_, i) => {
      const duration = range(rng, 1400, 3600) * lerp(1.4, 0.7, Math.min(1, state.windSpeed / 60));
      return {
        key: `gust-${i}`,
        y: rng() * height,
        length: range(rng, 60, 260),
        thickness: range(rng, 1, 2.6),
        opacity: range(rng, 0.08, 0.3),
        duration,
        delay: -rng() * duration,
      };
    });
  }, [height, state.seed, state.windSpeed, quality]);

  if (!motion) return null;

  return (
    <View style={FILL}>
      {gusts.map((gust) => (
        <Animated.View
          key={gust.key}
          style={{
            position: 'absolute',
            left: 0,
            top: gust.y,
            width: gust.length,
            height: gust.thickness,
            borderRadius: gust.thickness,
            opacity: gust.opacity,
            animationName: {
              '0%': { transform: [{ translateX: -gust.length }, { translateY: 0 }] },
              '50%': { transform: [{ translateX: width / 2 }, { translateY: -8 }] },
              '100%': { transform: [{ translateX: width + gust.length }, { translateY: 0 }] },
            },
            animationDuration: gust.duration,
            animationDelay: gust.delay,
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          }}>
          <LinearGradient
            colors={[withAlpha(palette.particle, 0), withAlpha(palette.particle, 0.9), withAlpha(palette.particle, 0)]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ))}
    </View>
  );
});

/** Suspended dust for haze — slow, aimless, barely there. */
export const DustLayer = memo(function DustLayer({
  width,
  height,
  state,
  palette,
  quality,
  motion,
}: LayerProps) {
  const motes = useMemo(() => {
    const count = scaleCount(50, quality);
    const rng = createRng(state.seed ^ 0x4455_5354);

    return Array.from({ length: count }, (_, i) => {
      const duration = range(rng, 9000, 22_000);
      return {
        key: `mote-${i}`,
        x: rng() * width,
        y: rng() * height,
        size: range(rng, 1.5, 4.5),
        opacity: range(rng, 0.12, 0.42),
        driftX: range(rng, -60, 60),
        driftY: range(rng, -40, 40),
        duration,
        delay: -rng() * duration,
      };
    });
  }, [width, height, state.seed, quality]);

  return (
    <View style={FILL}>
      {motes.map((mote) => (
        <Animated.View
          key={mote.key}
          style={{
            position: 'absolute',
            left: mote.x,
            top: mote.y,
            width: mote.size,
            height: mote.size,
            borderRadius: mote.size,
            backgroundColor: palette.particle,
            opacity: mote.opacity,
            ...(motion
              ? {
                  animationName: {
                    '0%': { transform: [{ translateX: 0 }, { translateY: 0 }] },
                    '50%': { transform: [{ translateX: mote.driftX }, { translateY: mote.driftY }] },
                    '100%': { transform: [{ translateX: 0 }, { translateY: 0 }] },
                  },
                  animationDuration: mote.duration,
                  animationDelay: mote.delay,
                  animationIterationCount: 'infinite' as const,
                  animationTimingFunction: 'ease-in-out' as const,
                }
              : null),
          }}
        />
      ))}
    </View>
  );
});
