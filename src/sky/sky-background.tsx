import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { getSkyRecipe, type SkyLayerName } from './derive';
import { CloudLayer, FogLayer } from './layers/clouds';
import { MoonLayer, StarLayer, SunLayer, SunRaysLayer } from './layers/celestial';
import {
  CityLightsLayer,
  DustLayer,
  FrostLayer,
  GlassDropsLayer,
  GustLayer,
  LightningLayer,
  RippleLayer,
  ShimmerLayer,
} from './layers/effects';
import { HailLayer, RainLayer, SleetLayer, SnowLayer } from './layers/precipitation';
import { getPalette, HORIZON_GLOW } from './palettes';
import { FILL, withAlpha, type LayerProps } from './layers/shared';
import { QUALITY_SCALE, type SkyQuality, type SkyState } from './types';

/**
 * The animated background.
 *
 * A "scene" is one complete sky: base gradient, golden-hour wash, and the set
 * of animated layers for a condition. When the weather changes, the incoming
 * scene is mounted *underneath* nothing and faded up over the outgoing one, so
 * sunny -> storm is a genuine blend of two live simulations rather than a swap.
 * The outgoing scene unmounts as soon as the fade lands, which is why both are
 * only ever on screen for the duration of the transition.
 */

const TRANSITION_MS = 1400;

/** Fields that, when changed, warrant a full cross-fade. */
function sceneKey(state: SkyState) {
  return `${state.condition}|${state.dayPart}`;
}

/**
 * Rebuilding a particle field mid-flight visibly reshuffles it, so continuous
 * inputs are quantised: small drifts in wind or sun angle are ignored, and
 * only meaningful changes re-seed the layers.
 */
function quantise(state: SkyState): SkyState {
  return {
    ...state,
    intensity: Math.round(state.intensity * 10) / 10,
    windSpeed: Math.round(state.windSpeed / 5) * 5,
    temperature: Math.round(state.temperature),
    sunProgress: Math.round(state.sunProgress * 50) / 50,
    moonPhase: Math.round(state.moonPhase * 50) / 50,
  };
}

type SceneProps = {
  state: SkyState;
  width: number;
  height: number;
  quality: SkyQuality;
  motion: boolean;
};

const LAYER_COMPONENTS: Record<Exclude<SkyLayerName, 'clouds'>, React.ComponentType<LayerProps>> = {
  stars: StarLayer,
  moon: MoonLayer,
  sun: SunLayer,
  sunRays: SunRaysLayer,
  rain: RainLayer,
  snow: SnowLayer,
  sleet: SleetLayer,
  hail: HailLayer,
  fog: FogLayer,
  lightning: LightningLayer,
  shimmer: ShimmerLayer,
  ripples: RippleLayer,
  glassDrops: GlassDropsLayer,
  cityLights: CityLightsLayer,
  frost: FrostLayer,
  gusts: GustLayer,
  dust: DustLayer,
};

const SkyScene = memo(function SkyScene({ state, width, height, quality, motion }: SceneProps) {
  const palette = getPalette(state.condition, state.dayPart);
  const recipe = useMemo(() => getSkyRecipe(state), [state]);
  const glow = HORIZON_GLOW[state.dayPart];

  const layerProps: LayerProps = {
    width,
    height,
    state,
    palette,
    quality: QUALITY_SCALE[quality],
    motion,
  };

  return (
    <View style={FILL}>
      <LinearGradient
        colors={palette.colors as unknown as readonly [string, string, ...string[]]}
        locations={palette.locations as unknown as readonly [number, number, ...number[]] | undefined}
        style={FILL}
      />

      {/* Golden hour: one warm wash reused by every condition. */}
      {glow.alpha > 0 && (
        <LinearGradient
          colors={glow.colors as unknown as readonly [string, string, ...string[]]}
          locations={[0, 0.55, 1]}
          style={FILL}
        />
      )}

      {/* Clouds carry two extra knobs, so they sit outside the generic table. */}
      {recipe.layers.includes('clouds') && (
        <CloudLayer {...layerProps} cloudiness={recipe.cloudiness} darkness={recipe.cloudDarkness} />
      )}

      {recipe.layers
        .filter((name): name is Exclude<SkyLayerName, 'clouds'> => name !== 'clouds')
        .map((name) => {
          const Layer = LAYER_COMPONENTS[name];
          return <Layer key={name} {...layerProps} />;
        })}

      {/* Legibility scrim — bright daytime skies need it, night skies don't. */}
      {palette.scrim > 0 && (
        <LinearGradient
          colors={[withAlpha('#050B18', palette.scrim), withAlpha('#050B18', palette.scrim * 0.35)]}
          locations={[0, 0.6]}
          style={FILL}
        />
      )}

      {/* Grounding vignette: keeps the tab dock readable over any sky. */}
      <LinearGradient
        colors={[withAlpha('#000000', 0), withAlpha('#000000', 0.16), withAlpha('#000000', 0.42)]}
        locations={[0.45, 0.78, 1]}
        style={FILL}
      />
    </View>
  );
});

export type SkyBackgroundProps = {
  state: SkyState;
  width: number;
  height: number;
  quality?: SkyQuality;
  motion?: boolean;
};

export const SkyBackground = memo(function SkyBackground({
  state,
  width,
  height,
  quality = 'high',
  motion = true,
}: SkyBackgroundProps) {
  // Depend on the quantised inputs, not on object identity — callers build a
  // fresh state object on every render, and re-seeding the particle fields
  // because the sun moved a hundredth of a degree would reshuffle the sky.
  const qIntensity = Math.round(state.intensity * 10);
  const qWind = Math.round(state.windSpeed / 5);
  const qSun = Math.round(state.sunProgress * 50);
  const qMoon = Math.round(state.moonPhase * 50);
  // Temperature decides whether heat shimmer is in the recipe at all, so it
  // has to be able to invalidate the scene.
  const qTemp = Math.round(state.temperature);

  const incoming = useMemo(
    () => quantise(state),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.condition, state.dayPart, state.seed, qIntensity, qWind, qSun, qMoon, qTemp],
  );

  const [current, setCurrent] = useState(incoming);
  const [outgoing, setOutgoing] = useState<SkyState | null>(null);
  const progress = useSharedValue(1);
  const currentRef = useRef(current);
  currentRef.current = current;

  useEffect(() => {
    const previous = currentRef.current;
    if (previous === incoming) return;

    if (sceneKey(previous) === sceneKey(incoming)) {
      // Same sky, refreshed numbers: swap in place, no fade needed.
      setCurrent(incoming);
      return;
    }

    setOutgoing(previous);
    setCurrent(incoming);
    progress.value = 0;
    progress.value = withTiming(1, { duration: TRANSITION_MS }, (finished) => {
      if (finished) runOnJS(setOutgoing)(null);
    });
  }, [incoming, progress]);

  const incomingStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {outgoing && (
        <SkyScene state={outgoing} width={width} height={height} quality={quality} motion={motion} />
      )}
      <Animated.View style={[StyleSheet.absoluteFill, outgoing ? incomingStyle : undefined]}>
        <SkyScene state={current} width={width} height={height} quality={quality} motion={motion} />
      </Animated.View>
    </View>
  );
});
