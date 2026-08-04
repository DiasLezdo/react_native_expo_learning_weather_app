import { memo, useId, useMemo } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { createRng, range } from '@/lib/rng';
import { FILL, lerp, mixHex, scaleCount, type LayerProps } from './shared';

/**
 * Cloud and fog layers.
 *
 * Clouds are masses of overlapping puffs, each filled with a **radial gradient
 * that fades to fully transparent at its rim**. That detail is the whole
 * component: a puff drawn as a flat semi-transparent disc has a hard edge, and
 * a field of hard edges reads as a heap of soap bubbles rather than as cloud.
 * With the alpha falling off smoothly there is no rim to see, so overlapping
 * puffs merge into one continuous mass and only their accumulated density
 * shows through.
 *
 * Geometry follows a real cumulus: a flat, slightly shaded base with domes
 * piled above it, largest near the middle.
 */

export type CloudLayerProps = LayerProps & {
  /** 0–1 coverage: drives both how many clouds and how opaque they are. */
  cloudiness: number;
  /** 0–1: 0 is a fair-weather cumulus, 1 is the underside of a storm cell. */
  darkness: number;
};

/** Three depth bands give parallax without any scroll coupling. */
const BANDS = [
  { topMin: 0.02, topMax: 0.16, scale: 0.55, opacity: 0.42, speedMin: 95_000, speedMax: 150_000 },
  { topMin: 0.06, topMax: 0.3, scale: 0.85, opacity: 0.6, speedMin: 58_000, speedMax: 92_000 },
  { topMin: -0.04, topMax: 0.2, scale: 1.25, opacity: 0.8, speedMin: 32_000, speedMax: 54_000 },
];

type Puff = { cx: number; cy: number; r: number };

type Cloud = {
  key: string;
  top: number;
  /** Drawing surface; wider and taller than the cloud so rims aren't clipped. */
  width: number;
  height: number;
  opacity: number;
  duration: number;
  delay: number;
  bob: number;
  puffs: Puff[];
  /** Flat shaded underside. */
  base: { cx: number; cy: number; rx: number; ry: number };
};

export const CloudLayer = memo(function CloudLayer({
  width,
  height,
  state,
  palette,
  quality,
  motion,
  cloudiness,
  darkness,
}: CloudLayerProps) {
  // SVG ids are document-global on web, so every layer instance needs its own.
  const gradientPrefix = `cl${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const clouds = useMemo(() => {
    if (cloudiness <= 0.01) return [];

    const rng = createRng(state.seed ^ 0x434c_4f55);
    const out: Cloud[] = [];
    // Faster wind means faster drift, but clamp it so a gale doesn't strobe.
    const windFactor = lerp(1, 0.45, Math.min(1, state.windSpeed / 70));

    BANDS.forEach((band, bandIndex) => {
      const count = scaleCount(lerp(1, 4, cloudiness) * (bandIndex === 2 ? 0.8 : 1), quality);

      for (let i = 0; i < count; i++) {
        const bodyWidth = range(rng, 0.4, 0.86) * width * band.scale;
        const bodyHeight = bodyWidth * range(rng, 0.34, 0.5);

        // Gradient rims extend past the geometry, so the canvas is padded.
        const pad = bodyHeight * 0.5;
        const canvasWidth = bodyWidth + pad * 2;
        const canvasHeight = bodyHeight + pad * 2;
        const baseY = pad + bodyHeight * 0.82;

        const puffs: Puff[] = [];

        // Lower row: sets the silhouette's width and its flat bottom.
        const rowCount = Math.round(range(rng, 4, 6));
        for (let p = 0; p < rowCount; p++) {
          const t = rowCount === 1 ? 0.5 : p / (rowCount - 1);
          // Peaks at the centre, tapers to the ends — a domed profile.
          const centreBias = Math.max(0, 1 - Math.abs(t - 0.5) * 1.7);
          const r = bodyHeight * range(rng, 0.3, 0.4) * lerp(0.78, 1.5, centreBias);

          puffs.push({
            cx: pad + t * bodyWidth + range(rng, -6, 6),
            cy: baseY - r * range(rng, 0.42, 0.62),
            r,
          });
        }

        // Upper domes: piled toward the middle, giving the cauliflower top.
        const domeCount = Math.round(range(rng, 2, 4));
        for (let d = 0; d < domeCount; d++) {
          const t = range(rng, 0.22, 0.78);
          const r = bodyHeight * range(rng, 0.26, 0.38);
          puffs.push({
            cx: pad + t * bodyWidth,
            cy: baseY - bodyHeight * range(rng, 0.42, 0.68) - r * 0.2,
            r,
          });
        }

        const duration = range(rng, band.speedMin, band.speedMax) * windFactor;

        out.push({
          key: `cloud-${bandIndex}-${i}`,
          top: range(rng, band.topMin, band.topMax) * height,
          width: canvasWidth,
          height: canvasHeight,
          opacity: band.opacity * lerp(0.4, 1, cloudiness),
          duration,
          delay: -rng() * duration,
          bob: range(rng, 4, 14),
          puffs,
          base: {
            cx: pad + bodyWidth / 2,
            cy: baseY,
            rx: bodyWidth * 0.46,
            ry: bodyHeight * 0.16,
          },
        });
      }
    });

    return out;
  }, [width, height, state.seed, state.windSpeed, cloudiness, quality]);

  // Storm clouds are the same geometry, lit from a darker sky.
  const body = mixHex(palette.cloud, '#141A24', darkness * 0.8);
  const underside = mixHex(body, '#0A0E16', 0.45 + darkness * 0.35);

  return (
    <View style={FILL}>
      {clouds.map((cloud, index) => {
        const puffId = `${gradientPrefix}p${index}`;
        const baseId = `${gradientPrefix}b${index}`;

        return (
          <Animated.View
            key={cloud.key}
            style={{
              position: 'absolute',
              top: cloud.top,
              left: 0,
              width: cloud.width,
              height: cloud.height,
              opacity: cloud.opacity,
              transform: [{ translateX: -cloud.width }],
              ...(motion
                ? {
                    animationName: {
                      '0%': { transform: [{ translateX: -cloud.width }, { translateY: 0 }] },
                      '50%': {
                        transform: [
                          { translateX: (width - cloud.width) / 2 },
                          { translateY: cloud.bob },
                        ],
                      },
                      '100%': { transform: [{ translateX: width }, { translateY: 0 }] },
                    },
                    animationDuration: cloud.duration,
                    animationDelay: cloud.delay,
                    animationIterationCount: 'infinite' as const,
                    animationTimingFunction: 'linear' as const,
                  }
                : null),
            }}>
            <Svg width={cloud.width} height={cloud.height}>
              <Defs>
                {/*
                 * Opaque core out to 45%, then a long fade to nothing. The tail
                 * is what dissolves the edge; shortening it brings the bubble
                 * outline straight back.
                 */}
                <RadialGradient id={puffId} cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={body} stopOpacity={0.92} />
                  <Stop offset="0.45" stopColor={body} stopOpacity={0.78} />
                  <Stop offset="0.72" stopColor={body} stopOpacity={0.38} />
                  <Stop offset="0.88" stopColor={body} stopOpacity={0.12} />
                  <Stop offset="1" stopColor={body} stopOpacity={0} />
                </RadialGradient>

                <RadialGradient id={baseId} cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={underside} stopOpacity={0.5} />
                  <Stop offset="0.6" stopColor={underside} stopOpacity={0.26} />
                  <Stop offset="1" stopColor={underside} stopOpacity={0} />
                </RadialGradient>
              </Defs>

              {/* Shaded base first, so the lit puffs sit on top of it. */}
              <Ellipse
                cx={cloud.base.cx}
                cy={cloud.base.cy}
                rx={cloud.base.rx}
                ry={cloud.base.ry}
                fill={`url(#${baseId})`}
              />

              {cloud.puffs.map((puff, p) => (
                <Circle key={p} cx={puff.cx} cy={puff.cy} r={puff.r} fill={`url(#${puffId})`} />
              ))}
            </Svg>
          </Animated.View>
        );
      })}
    </View>
  );
});

/**
 * Fog and mist.
 *
 * Each bank is a very wide, very flat ellipse with a radial falloff, so it
 * dissolves on every side. It was previously a rectangle holding a *horizontal*
 * gradient: that faded away at the left and right ends but stopped dead at the
 * top and bottom, drawing a pair of crisp horizontal lines across the sky
 * wherever the band was densest. Fog has no edges.
 */
export const FogLayer = memo(function FogLayer({
  width,
  height,
  state,
  palette,
  quality,
  motion,
}: LayerProps) {
  const uid = `fog${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const bands = useMemo(() => {
    const count = scaleCount(lerp(3, 7, state.intensity), Math.max(quality, 0.5));
    const rng = createRng(state.seed ^ 0x464f_4708);

    return Array.from({ length: count }, (_, i) => {
      const duration = range(rng, 26_000, 62_000);
      return {
        key: `fog-${i}`,
        top: range(rng, -0.05, 0.9) * height,
        height: range(rng, 0.16, 0.4) * height,
        width: width * range(rng, 1.4, 2.2),
        opacity: range(rng, 0.16, 0.44) * lerp(0.5, 1.15, state.intensity),
        duration,
        delay: -rng() * duration,
        // Alternate direction so the banks shear against each other.
        reverse: i % 2 === 1,
      };
    });
  }, [width, height, state.seed, state.intensity, quality]);

  const tint = palette.particle;

  return (
    <View style={FILL}>
      {bands.map((band) => {
        const from = band.reverse ? 0 : -(band.width - width);
        const to = band.reverse ? -(band.width - width) : 0;

        return (
          <Animated.View
            key={band.key}
            style={{
              position: 'absolute',
              top: band.top,
              left: 0,
              width: band.width,
              height: band.height,
              opacity: band.opacity,
              transform: [{ translateX: from }],
              ...(motion
                ? {
                    animationName: {
                      '0%': { transform: [{ translateX: from }, { translateY: 0 }] },
                      '50%': { transform: [{ translateX: (from + to) / 2 }, { translateY: 10 }] },
                      '100%': { transform: [{ translateX: to }, { translateY: 0 }] },
                    },
                    animationDuration: band.duration,
                    animationDelay: band.delay,
                    animationIterationCount: 'infinite' as const,
                    animationDirection: 'alternate' as const,
                    animationTimingFunction: 'ease-in-out' as const,
                  }
                : null),
            }}>
            <Svg width={band.width} height={band.height}>
              <Defs>
                <RadialGradient id={`${uid}${band.key}`} cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={tint} stopOpacity={0.85} />
                  <Stop offset="0.4" stopColor={tint} stopOpacity={0.6} />
                  <Stop offset="0.7" stopColor={tint} stopOpacity={0.26} />
                  <Stop offset="0.88" stopColor={tint} stopOpacity={0.08} />
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
        );
      })}
    </View>
  );
});
