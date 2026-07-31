import { memo, useEffect, useId, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';

import { Ink, Radius, Space, Type } from '@/design/tokens';
import { SkyText } from './ui/sky-text';
import { GlassPanel } from './ui/glass';

/**
 * Metric tiles.
 *
 * Each number is paired with a drawing of itself — a filled arc, a compass
 * needle, a sun on its arc — so the tiles are scannable as shapes before they
 * are read as values. Every reveal animates a single SVG prop rather than a
 * tree of views.
 */

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const MetricTile = memo(function MetricTile({
  label,
  children,
  footer,
  index,
  style,
}: {
  label: string;
  children: ReactNode;
  footer?: string;
  index?: number;
  style?: object;
}) {
  return (
    <GlassPanel index={index} radius={Radius.lg} style={[styles.tile, style]}>
      <SkyText style={[Type.label, { color: Ink.tertiary }]}>{label.toUpperCase()}</SkyText>
      <View style={styles.tileBody}>{children}</View>
      {footer ? (
        <SkyText style={[Type.caption, { color: Ink.secondary }]} numberOfLines={2}>
          {footer}
        </SkyText>
      ) : null}
    </GlassPanel>
  );
});

/** Circular gauge — used for UV, humidity and air quality. */
export const MetricRing = memo(function MetricRing({
  progress,
  value,
  caption,
  size = 88,
  strokeWidth = 8,
  colors = ['#7FD2FF', '#B7A2FF'],
}: {
  /** 0–1. */
  progress: number;
  value: string;
  caption?: string;
  size?: number;
  strokeWidth?: number;
  colors?: [string, string];
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const reveal = useSharedValue(0);
  // Four rings share the Today screen, and on web SVG ids are document-global —
  // so each gradient needs its own. `useId` embeds colons, which are illegal in
  // an id and break `url(#…)`, hence the strip.
  const gradientId = `ring${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    reveal.value = 0;
    reveal.value = withTiming(Math.min(1, Math.max(0, progress)), {
      duration: 1000,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, reveal]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - reveal.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset="1" stopColor={colors[1]} />
          </SvgLinearGradient>
        </Defs>

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // Start the arc at 12 o'clock instead of 3.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <SkyText style={[Type.heading, { fontSize: 22 }]}>{value}</SkyText>
      {caption ? (
        <SkyText style={[Type.caption, { color: Ink.tertiary, fontSize: 10 }]}>{caption}</SkyText>
      ) : null}
    </View>
  );
});

/**
 * Sun path for the day, with the current position marked.
 *
 * The dashed remainder past the sun is the part of the day still to come, which
 * makes "how much daylight is left" readable at a glance.
 */
export const SunArc = memo(function SunArc({
  progress,
  sunriseLabel,
  sunsetLabel,
  width,
  height = 96,
}: {
  progress: number;
  sunriseLabel: string;
  sunsetLabel: string;
  width: number;
  height?: number;
}) {
  const pad = 18;
  const baseline = height - 26;
  const rx = (width - pad * 2) / 2;
  const ry = baseline - 14;
  const cx = width / 2;

  const t = Math.min(1, Math.max(0, progress));
  const angle = Math.PI * t;
  const sunX = cx - rx * Math.cos(angle);
  const sunY = baseline - ry * Math.sin(angle);

  const arc = `M ${pad} ${baseline} A ${rx} ${ry} 0 0 1 ${width - pad} ${baseline}`;

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgLinearGradient id="sunArc" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFB65C" />
            <Stop offset="0.5" stopColor="#FFE9A8" />
            <Stop offset="1" stopColor="#FF8A4C" />
          </SvgLinearGradient>
        </Defs>

        {/* Horizon. */}
        <Line
          x1={pad - 8}
          y1={baseline}
          x2={width - pad + 8}
          y2={baseline}
          stroke="rgba(255,255,255,0.24)"
          strokeWidth={1}
        />

        <Path d={arc} stroke="rgba(255,255,255,0.2)" strokeWidth={2} fill="none" strokeDasharray="5 6" />
        {/* Travelled portion, drawn solid over the dashes. */}
        <Path
          d={arc}
          stroke="url(#sunArc)"
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${Math.PI * ((rx + ry) / 2) * t} ${9999}`}
        />

        <Circle cx={sunX} cy={sunY} r={13} fill="#FFD98A" opacity={0.22} />
        <Circle cx={sunX} cy={sunY} r={7} fill="#FFF3D0" />
      </Svg>

      <View style={styles.sunLabels}>
        <SkyText style={[Type.caption, { color: Ink.secondary }]}>{sunriseLabel}</SkyText>
        <SkyText style={[Type.caption, { color: Ink.secondary }]}>{sunsetLabel}</SkyText>
      </View>
    </View>
  );
});

/** Compass with a needle showing where the wind is coming from. */
export const WindCompass = memo(function WindCompass({
  direction,
  speed,
  gust,
  size = 108,
}: {
  direction: number;
  speed: string;
  gust?: string;
  size?: number;
}) {
  const radius = size / 2;
  const rotation = useSharedValue(direction);

  useEffect(() => {
    rotation.value = withTiming(direction, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [direction, rotation]);

  /*
   * The needle is spun by rotating a plain RN view, not an SVG group.
   * react-native-svg's `originX`/`originY` props are native-only and throw in
   * the web renderer; a view transform behaves identically everywhere, and a
   * square view rotates about its own centre — which is where the dial's
   * centre is — so no origin needs specifying at all.
   *
   * Meteorological degrees name the direction the wind blows *from*, which is
   * where the needle's tail should point: hence the 180° flip.
   */
  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value + 180}deg` }],
  }));

  const ticks = Array.from({ length: 36 }, (_, i) => {
    const angle = (i * 10 * Math.PI) / 180;
    const major = i % 9 === 0;
    const inner = radius - (major ? 12 : 7);
    const outer = radius - 3;
    return (
      <Line
        key={i}
        x1={radius + Math.sin(angle) * inner}
        y1={radius - Math.cos(angle) * inner}
        x2={radius + Math.sin(angle) * outer}
        y2={radius - Math.cos(angle) * outer}
        stroke={major ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.22)'}
        strokeWidth={major ? 2 : 1}
        strokeLinecap="round"
      />
    );
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={radius} cy={radius} r={radius - 2} stroke="rgba(255,255,255,0.14)" strokeWidth={1} fill="none" />
        {ticks}
      </Svg>

      <Animated.View style={[StyleSheet.absoluteFill, needleStyle]}>
        <Svg width={size} height={size}>
          <Path
            d={`M ${radius} ${radius - (radius - 20)} L ${radius - 7} ${radius + 8} L ${radius} ${radius + 3} L ${
              radius + 7
            } ${radius + 8} Z`}
            fill="#7FD2FF"
          />
          <Path
            d={`M ${radius} ${radius + (radius - 20)} L ${radius - 6} ${radius - 6} L ${radius} ${radius - 2} L ${
              radius + 6
            } ${radius - 6} Z`}
            fill="rgba(255,255,255,0.45)"
          />
        </Svg>
      </Animated.View>

      <View style={{ alignItems: 'center' }}>
        <SkyText style={[Type.heading, { fontSize: 20 }]}>{speed}</SkyText>
        {gust ? <SkyText style={[Type.caption, { color: Ink.tertiary, fontSize: 10 }]}>{gust}</SkyText> : null}
      </View>
    </View>
  );
});

/** Horizontal level indicator for bounded values like pressure. */
export const MetricBar = memo(function MetricBar({
  progress,
  leftLabel,
  rightLabel,
  value,
}: {
  progress: number;
  leftLabel: string;
  rightLabel: string;
  value: string;
}) {
  const reveal = useSharedValue(0);
  const gradientId = `bar${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  useEffect(() => {
    reveal.value = withTiming(Math.min(1, Math.max(0, progress)), { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [progress, reveal]);

  const markerProps = useAnimatedProps(() => ({ cx: 4 + reveal.value * 92 }));

  return (
    <View style={{ gap: 8, alignSelf: 'stretch' }}>
      <SkyText style={[Type.display, { fontSize: 30 }]}>{value}</SkyText>
      <Svg width="100%" height={14} viewBox="0 0 100 14" preserveAspectRatio="none">
        <Defs>
          <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#7C6BFF" />
            <Stop offset="0.5" stopColor="#7FD2FF" />
            <Stop offset="1" stopColor="#FFD152" />
          </SvgLinearGradient>
        </Defs>
        <Path d="M2 7 H98" stroke={`url(#${gradientId})`} strokeWidth={4} strokeLinecap="round" opacity={0.5} />
        <AnimatedCircle animatedProps={markerProps} cy={7} r={5} fill="#FFFFFF" />
      </Svg>
      <View style={styles.barLabels}>
        <SkyText style={[Type.caption, { color: Ink.tertiary, fontSize: 10 }]}>{leftLabel}</SkyText>
        <SkyText style={[Type.caption, { color: Ink.tertiary, fontSize: 10 }]}>{rightLabel}</SkyText>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 168,
    padding: Space.md,
    gap: Space.xs,
    justifyContent: 'space-between',
  },
  tileBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunLabels: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
