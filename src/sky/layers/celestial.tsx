import { LinearGradient } from 'expo-linear-gradient';
import { memo, useId, useMemo } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { createRng, range } from '@/lib/rng';
import { FILL, lerp, mixHex, scaleCount, withAlpha, type LayerProps } from './shared';

/**
 * Sun, sun rays, stars, and the moon.
 *
 * The sun and moon are positioned on a real arc from `sunProgress`, so golden
 * hour actually happens at the horizon and midday sits overhead.
 *
 * Both are drawn as **radial gradients, not stacked discs**. A halo built from
 * concentric circles at flat opacity has a hard edge at every step, and those
 * visible rings are what make a sun read as a cartoon sticker pasted onto the
 * sky. A continuous falloff has no edge anywhere, so the corona dissolves into
 * the sky the way a real one does.
 */

/** Where the sun sits for a given progress through the day. */
function sunPosition(progress: number, width: number, height: number) {
  const t = Math.min(1, Math.max(0, progress));
  return {
    x: lerp(0.14, 0.86, t) * width,
    // Parabolic arc: lowest at both ends, highest at solar noon.
    y: lerp(0.4, 0.08, Math.sin(t * Math.PI)) * height,
  };
}

/** 0 at the horizon, 1 at solar noon. Drives the sun's colour and size. */
function solarAltitude(progress: number) {
  return Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI);
}

export const SunLayer = memo(function SunLayer({ width, height, state, palette, motion }: LayerProps) {
  const uid = `sun${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { x, y } = sunPosition(state.sunProgress, width, height);
  const altitude = solarAltitude(state.sunProgress);

  /*
   * Low sun is red and visibly larger — the long slant through the atmosphere
   * scatters the blue out and refraction magnifies the disc. High sun is a
   * near-white point you can't look at. Interpolating between those two states
   * is most of what makes it read as a real sun rather than a yellow sticker.
   */
  const warm = mixHex('#FF7A2F', palette.accent, altitude);
  const rim = mixHex('#FFB05A', '#FFE9A8', altitude);
  const coreColour = mixHex('#FFEAC0', '#FFFFFF', altitude);

  const disc = lerp(84, 62, altitude);
  // Canvas has to hold the entire bloom, which reaches far past the disc.
  const canvas = disc * 9;
  const centre = canvas / 2;

  return (
    <View style={FILL}>
      <Animated.View
        style={{
          position: 'absolute',
          left: x - centre,
          top: y - centre,
          width: canvas,
          height: canvas,
          ...(motion
            ? {
                // A slow, shallow breath. Anything stronger draws attention to
                // the bloom's outer limit, which should never be perceptible.
                animationName: {
                  '0%': { transform: [{ scale: 0.97 }], opacity: 0.88 },
                  '50%': { transform: [{ scale: 1.03 }], opacity: 1 },
                  '100%': { transform: [{ scale: 0.97 }], opacity: 0.88 },
                },
                animationDuration: 7200,
                animationIterationCount: 'infinite' as const,
                animationTimingFunction: 'ease-in-out' as const,
              }
            : null),
        }}>
        <Svg width={canvas} height={canvas}>
          <Defs>
            {/* Atmospheric bloom: very faint, very wide, no perceptible end. */}
            <RadialGradient id={`${uid}bloom`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={warm} stopOpacity={0.3} />
              <Stop offset="0.18" stopColor={warm} stopOpacity={0.17} />
              <Stop offset="0.38" stopColor={warm} stopOpacity={0.075} />
              <Stop offset="0.62" stopColor={warm} stopOpacity={0.028} />
              <Stop offset="0.82" stopColor={warm} stopOpacity={0.008} />
              <Stop offset="1" stopColor={warm} stopOpacity={0} />
            </RadialGradient>

            {/* Corona: the bright ring of light hugging the disc. */}
            <RadialGradient id={`${uid}corona`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={rim} stopOpacity={0.85} />
              <Stop offset="0.3" stopColor={rim} stopOpacity={0.5} />
              <Stop offset="0.58" stopColor={warm} stopOpacity={0.22} />
              <Stop offset="0.8" stopColor={warm} stopOpacity={0.07} />
              <Stop offset="1" stopColor={warm} stopOpacity={0} />
            </RadialGradient>

            {/*
             * Core. Solid to 62%, then blown out through the rim rather than
             * stopped at it — a hard circular edge here is the single biggest
             * cartoon tell, even with a perfect corona around it.
             */}
            <RadialGradient id={`${uid}core`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="0.45" stopColor={coreColour} stopOpacity={1} />
              <Stop offset="0.68" stopColor={coreColour} stopOpacity={0.97} />
              <Stop offset="0.84" stopColor={rim} stopOpacity={0.72} />
              <Stop offset="0.94" stopColor={warm} stopOpacity={0.3} />
              <Stop offset="1" stopColor={warm} stopOpacity={0} />
            </RadialGradient>
          </Defs>

          <Circle cx={centre} cy={centre} r={canvas / 2} fill={`url(#${uid}bloom)`} />
          <Circle cx={centre} cy={centre} r={disc * 1.75} fill={`url(#${uid}corona)`} />
          <Circle cx={centre} cy={centre} r={disc * 0.72} fill={`url(#${uid}core)`} />
        </Svg>
      </Animated.View>
    </View>
  );
});

/**
 * Rotating sun rays.
 *
 * Each element spans the full diameter of the group and is filled with a
 * gradient that peaks at its centre — so one view draws two opposing rays, and
 * rotating it about its own centre is the same as rotating about the sun.
 * Eight views therefore render sixteen rays.
 */
export const SunRaysLayer = memo(function SunRaysLayer({
  width,
  height,
  state,
  palette,
  quality,
  motion,
}: LayerProps) {
  const { x, y } = sunPosition(state.sunProgress, width, height);
  const size = Math.max(width, height) * 1.15;
  const rayCount = scaleCount(9, Math.max(quality, 0.5));

  /*
   * Crepuscular rays are a low-sun phenomenon: strong at golden hour, when
   * light rakes through the atmosphere, and effectively invisible at noon.
   * Scaling them by altitude stops overhead sun from throwing hard diagonal
   * streaks across the whole sky.
   */
  const strength = lerp(1, 0.28, solarAltitude(state.sunProgress));

  const rays = useMemo(() => {
    const rng = createRng(state.seed ^ 0x5241_5953);
    return Array.from({ length: rayCount }, (_, i) => ({
      key: `ray-${i}`,
      rotation: (i * 180) / rayCount + range(rng, -4, 4),
      // Wider and fainter than before: a broad, soft wash reads as light,
      // where a narrow bright line reads as a drawn spoke.
      width: range(rng, 14, 54),
      opacity: range(rng, 0.02, 0.075),
    }));
  }, [rayCount, state.seed]);

  return (
    <View style={FILL}>
      <Animated.View
        style={{
          position: 'absolute',
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          ...(motion
            ? {
                animationName: {
                  '0%': { transform: [{ rotate: '0deg' }], opacity: 0.55 },
                  '50%': { transform: [{ rotate: '180deg' }], opacity: 1 },
                  '100%': { transform: [{ rotate: '360deg' }], opacity: 0.55 },
                },
                animationDuration: 78_000,
                animationIterationCount: 'infinite' as const,
                animationTimingFunction: 'linear' as const,
              }
            : null),
        }}>
        {rays.map((ray) => (
          <View
            key={ray.key}
            style={{
              position: 'absolute',
              left: size / 2 - ray.width / 2,
              top: 0,
              width: ray.width,
              height: size,
              transform: [{ rotate: `${ray.rotation}deg` }],
            }}>
            <LinearGradient
              colors={[
                withAlpha(palette.accent, 0),
                withAlpha(palette.accent, ray.opacity * strength * 0.5),
                withAlpha('#FFFFFF', ray.opacity * strength * 1.4),
                withAlpha(palette.accent, ray.opacity * strength * 0.5),
                withAlpha(palette.accent, 0),
              ]}
              locations={[0, 0.34, 0.5, 0.66, 1]}
              style={{ flex: 1 }}
            />
          </View>
        ))}
      </Animated.View>
    </View>
  );
});

/** Twinkling starfield, with the occasional shooting star. */
export const StarLayer = memo(function StarLayer({
  width,
  height,
  state,
  palette,
  quality,
  motion,
}: LayerProps) {
  const stars = useMemo(() => {
    const count = scaleCount(90, quality);
    const rng = createRng(state.seed ^ 0x5354_4152);

    return Array.from({ length: count }, (_, i) => {
      const depth = rng();
      const duration = range(rng, 2600, 7200);
      return {
        key: `star-${i}`,
        x: rng() * width,
        // Stars thin out toward the horizon, where haze would wash them out.
        y: Math.pow(rng(), 1.5) * height * 0.78,
        size: lerp(1.1, 3.2, depth),
        baseOpacity: lerp(0.25, 1, depth),
        duration,
        delay: -rng() * duration,
      };
    });
  }, [width, height, state.seed, quality]);

  const shootingStars = useMemo(() => {
    const count = scaleCount(3, quality);
    const rng = createRng(state.seed ^ 0x5348_4f54);

    return Array.from({ length: count }, (_, i) => {
      // Long cycles with a brief visible window make the streaks feel random
      // even though each one is a fixed loop.
      const duration = range(rng, 11_000, 23_000);
      return {
        key: `shoot-${i}`,
        x: range(rng, 0.05, 0.7) * width,
        y: range(rng, 0.02, 0.4) * height,
        length: range(rng, 90, 190),
        travel: range(rng, 180, 380),
        duration,
        delay: -rng() * duration,
      };
    });
  }, [width, height, state.seed, quality]);

  const tint = palette.particle;

  return (
    <View style={FILL}>
      {stars.map((star) => (
        <Animated.View
          key={star.key}
          style={{
            position: 'absolute',
            left: star.x,
            top: star.y,
            width: star.size,
            height: star.size,
            borderRadius: star.size,
            backgroundColor: tint,
            opacity: star.baseOpacity,
            ...(motion
              ? {
                  animationName: {
                    '0%': { opacity: star.baseOpacity * 0.25, transform: [{ scale: 0.7 }] },
                    '50%': { opacity: star.baseOpacity, transform: [{ scale: 1.25 }] },
                    '100%': { opacity: star.baseOpacity * 0.25, transform: [{ scale: 0.7 }] },
                  },
                  animationDuration: star.duration,
                  animationDelay: star.delay,
                  animationIterationCount: 'infinite' as const,
                  animationTimingFunction: 'ease-in-out' as const,
                }
              : null),
          }}
        />
      ))}

      {motion &&
        shootingStars.map((shot) => (
          <Animated.View
            key={shot.key}
            style={{
              position: 'absolute',
              left: shot.x,
              top: shot.y,
              width: shot.length,
              height: 1.6,
              opacity: 0,
              transform: [{ rotate: '18deg' }],
              animationName: {
                '0%': { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '18deg' }] },
                '1.5%': { opacity: 0.9, transform: [{ translateX: shot.travel * 0.1 }, { translateY: shot.travel * 0.033 }, { rotate: '18deg' }] },
                '5%': { opacity: 0, transform: [{ translateX: shot.travel }, { translateY: shot.travel * 0.33 }, { rotate: '18deg' }] },
                '100%': { opacity: 0, transform: [{ translateX: shot.travel }, { translateY: shot.travel * 0.33 }, { rotate: '18deg' }] },
              },
              animationDuration: shot.duration,
              animationDelay: shot.delay,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'linear',
            }}>
            <LinearGradient
              colors={[withAlpha(tint, 0), withAlpha('#FFFFFF', 0.95)]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ flex: 1, borderRadius: 2 }}
            />
          </Animated.View>
        ))}
    </View>
  );
});

/** The moon, with a terminator shadow driven by the real lunar phase. */
export const MoonLayer = memo(function MoonLayer({ width, height, state, palette, motion }: LayerProps) {
  const uid = `moon${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const size = 78;
  const x = width * 0.74;
  const y = height * 0.14;

  // Illuminated fraction: 0 at new moon, 1 at full. The shadow disc slides
  // across the face by that amount.
  const illumination = 1 - Math.abs(state.moonPhase - 0.5) * 2;
  const waxing = state.moonPhase < 0.5;
  const shadowOffset = (1 - illumination) * size * (waxing ? -1 : 1);

  const craters = useMemo(() => {
    const rng = createRng(state.seed ^ 0x4d4f_4f4e);
    return Array.from({ length: 5 }, (_, i) => ({
      key: `crater-${i}`,
      x: range(rng, 0.14, 0.7) * size,
      y: range(rng, 0.14, 0.7) * size,
      r: range(rng, 4, 11),
      opacity: range(rng, 0.05, 0.13),
    }));
  }, [state.seed]);

  // Moonlight scatters in haze the same way sunlight does, so the halo gets
  // the same continuous falloff rather than a flat translucent disc.
  const glow = size * 5;

  return (
    <View style={FILL}>
      <Animated.View
        style={{
          position: 'absolute',
          left: x - glow / 2,
          top: y - glow / 2,
          width: glow,
          height: glow,
          ...(motion
            ? {
                animationName: {
                  '0%': { transform: [{ scale: 0.97 }], opacity: 0.75 },
                  '50%': { transform: [{ scale: 1.03 }], opacity: 1 },
                  '100%': { transform: [{ scale: 0.97 }], opacity: 0.75 },
                },
                animationDuration: 9600,
                animationIterationCount: 'infinite' as const,
                animationTimingFunction: 'ease-in-out' as const,
              }
            : null),
        }}>
        <Svg width={glow} height={glow}>
          <Defs>
            <RadialGradient id={`${uid}glow`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={palette.accent} stopOpacity={0.34} />
              <Stop offset="0.16" stopColor={palette.accent} stopOpacity={0.16} />
              <Stop offset="0.38" stopColor={palette.accent} stopOpacity={0.06} />
              <Stop offset="0.66" stopColor={palette.accent} stopOpacity={0.018} />
              <Stop offset="1" stopColor={palette.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={glow / 2} cy={glow / 2} r={glow / 2} fill={`url(#${uid}glow)`} />
        </Svg>
      </Animated.View>

      <Animated.View
        style={{
          position: 'absolute',
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: '#F4F3EA',
          overflow: 'hidden',
          ...(motion
            ? {
                animationName: {
                  '0%': { transform: [{ translateY: 0 }] },
                  '50%': { transform: [{ translateY: 6 }] },
                  '100%': { transform: [{ translateY: 0 }] },
                },
                animationDuration: 14_000,
                animationIterationCount: 'infinite' as const,
                animationTimingFunction: 'ease-in-out' as const,
              }
            : null),
        }}>
        {craters.map((crater) => (
          <View
            key={crater.key}
            style={{
              position: 'absolute',
              left: crater.x,
              top: crater.y,
              width: crater.r * 2,
              height: crater.r * 2,
              borderRadius: crater.r,
              backgroundColor: withAlpha('#8C8B7E', crater.opacity * 8),
            }}
          />
        ))}

        {/* Terminator: a disc in sky colour occluding the unlit portion. */}
        {illumination < 0.97 && (
          <View
            style={{
              position: 'absolute',
              left: shadowOffset,
              top: -1,
              width: size,
              height: size + 2,
              borderRadius: size,
              backgroundColor: palette.colors[1],
            }}
          />
        )}
      </Animated.View>
    </View>
  );
});
