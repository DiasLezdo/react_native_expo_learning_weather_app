import { memo, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';

import type { WeatherCondition } from '@/weather/types';

/**
 * Condition icons, drawn as SVG on a 64×64 grid.
 *
 * Bespoke rather than SF Symbols so the same glyphs render identically on both
 * platforms and match the app's line weight. Motion is opt-in: the hero icon
 * animates, list rows don't, because a forecast list is 10 icons and none of
 * them need to be moving while the user is scrolling past.
 */

export type WeatherIconProps = {
  condition: WeatherCondition;
  size?: number;
  isDay?: boolean;
  color?: string;
  /** Secondary colour for precipitation strokes and the sun. */
  accent?: string;
  animated?: boolean;
};

const CLOUD_FILL_OPACITY = 0.95;

/**
 * Cloud built from three circles and a base — unions cleanly at any scale.
 *
 * `dy` is baked into each shape's coordinates rather than applied as a group
 * transform: react-native-svg's shorthand transform props (`translateY`,
 * `originX`, …) exist only in the native renderer and throw on web.
 */
function Cloud({ color, opacity = CLOUD_FILL_OPACITY, dy = 0 }: { color: string; opacity?: number; dy?: number }) {
  return (
    <G opacity={opacity}>
      <Circle cx={23} cy={30 + dy} r={10} fill={color} />
      <Circle cx={35} cy={25 + dy} r={13} fill={color} />
      <Circle cx={45} cy={31 + dy} r={9} fill={color} />
      <Rect x={21} y={31 + dy} width={26} height={11} rx={5.5} fill={color} />
    </G>
  );
}

function Sun({ color, cx = 32, cy = 30, r = 12 }: { color: string; cx?: number; cy?: number; r?: number }) {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI) / 4;
    const inner = r + 4;
    const outer = r + 9;
    return (
      <Line
        key={i}
        x1={cx + Math.cos(angle) * inner}
        y1={cy + Math.sin(angle) * inner}
        x2={cx + Math.cos(angle) * outer}
        y2={cy + Math.sin(angle) * outer}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
      />
    );
  });

  return (
    <G>
      {rays}
      <Circle cx={cx} cy={cy} r={r} fill={color} />
    </G>
  );
}

function Moon({ color }: { color: string }) {
  return (
    <Path
      d="M40 16 A17 17 0 1 0 40 50 A13.5 13.5 0 1 1 40 16 Z"
      fill={color}
    />
  );
}

/** Slanted rounded strokes read as falling rain at any size. */
function Drops({ color, xs, y = 46, length = 9 }: { color: string; xs: number[]; y?: number; length?: number }) {
  return (
    <G>
      {xs.map((x, i) => (
        <Line
          key={i}
          x1={x}
          y1={y}
          x2={x - 3}
          y2={y + length}
          stroke={color}
          strokeWidth={3.2}
          strokeLinecap="round"
        />
      ))}
    </G>
  );
}

function Flakes({ color, points }: { color: string; points: { x: number; y: number; r: number }[] }) {
  return (
    <G>
      {points.map((p, i) => (
        <G key={i}>
          {[0, 60, 120].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <Line
                key={angle}
                x1={p.x - Math.cos(rad) * p.r}
                y1={p.y - Math.sin(rad) * p.r}
                x2={p.x + Math.cos(rad) * p.r}
                y2={p.y + Math.sin(rad) * p.r}
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
              />
            );
          })}
        </G>
      ))}
    </G>
  );
}

function Bolt({ color }: { color: string }) {
  return <Path d="M35 40 L26 54 L32 54 L29 62 L41 48 L34 48 Z" fill={color} />;
}

function glyph(condition: WeatherCondition, isDay: boolean, color: string, accent: string): ReactNode {
  switch (condition) {
    case 'clear':
      return isDay ? <Sun color={accent} cx={32} cy={32} r={13} /> : <Moon color={color} />;

    case 'partly-cloudy':
      return (
        <G>
          {isDay ? <Sun color={accent} cx={42} cy={22} r={9} /> : <Moon color={color} />}
          <Cloud color={color} dy={6} />
        </G>
      );

    case 'cloudy':
      return (
        <G>
          <Cloud color={color} opacity={0.45} dy={-6} />
          <Cloud color={color} dy={6} />
        </G>
      );

    case 'overcast':
      return (
        <G>
          <Cloud color={color} opacity={0.55} dy={-8} />
          <Cloud color={color} dy={4} />
          <Rect x={16} y={44} width={34} height={4} rx={2} fill={color} opacity={0.5} />
        </G>
      );

    case 'fog':
      return (
        <G>
          <Cloud color={color} dy={-4} />
          {[46, 53, 60].map((y, i) => (
            <Rect
              key={y}
              x={14 + i * 3}
              y={y}
              width={38 - i * 6}
              height={3.4}
              rx={1.7}
              fill={color}
              opacity={0.75 - i * 0.18}
            />
          ))}
        </G>
      );

    case 'drizzle':
      return (
        <G>
          <Cloud color={color} dy={-4} />
          <Drops color={accent} xs={[27, 39]} y={45} length={7} />
        </G>
      );

    case 'rain':
      return (
        <G>
          <Cloud color={color} dy={-4} />
          <Drops color={accent} xs={[24, 33, 42]} y={45} />
        </G>
      );

    case 'heavy-rain':
      return (
        <G>
          <Cloud color={color} dy={-6} />
          <Drops color={accent} xs={[22, 30, 38, 46]} y={42} length={11} />
          <Drops color={accent} xs={[26, 34, 42]} y={54} length={7} />
        </G>
      );

    case 'thunderstorm':
      return (
        <G>
          <Cloud color={color} dy={-6} />
          <Drops color={accent} xs={[22, 46]} y={42} length={9} />
          <Bolt color={accent} />
        </G>
      );

    case 'snow':
      return (
        <G>
          <Cloud color={color} dy={-4} />
          <Flakes
            color={accent}
            points={[
              { x: 24, y: 50, r: 5 },
              { x: 40, y: 50, r: 5 },
              { x: 32, y: 59, r: 4 },
            ]}
          />
        </G>
      );

    case 'sleet':
      return (
        <G>
          <Cloud color={color} dy={-4} />
          <Drops color={accent} xs={[26]} y={45} />
          <Flakes color={accent} points={[{ x: 40, y: 51, r: 5 }]} />
        </G>
      );

    case 'hail':
      return (
        <G>
          <Cloud color={color} dy={-4} />
          {[
            { x: 25, y: 49 },
            { x: 38, y: 47 },
            { x: 32, y: 58 },
          ].map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={3.6} fill={accent} />
          ))}
        </G>
      );

    case 'haze':
      return (
        <G>
          <Sun color={accent} cx={32} cy={26} r={11} />
          {[44, 52, 60].map((y, i) => (
            <Path
              key={y}
              d={`M12 ${y} q 8 -5 16 0 t 16 0 t 8 0`}
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
              opacity={0.85 - i * 0.2}
            />
          ))}
        </G>
      );

    case 'wind':
      return (
        <G>
          {[
            { d: 'M10 24 h26 a6 6 0 1 0 -6 -6', o: 1 },
            { d: 'M10 36 h34 a7 7 0 1 1 -7 7', o: 0.8 },
            { d: 'M14 48 h20 a5 5 0 1 1 -5 5', o: 0.6 },
          ].map((line, i) => (
            <Path
              key={i}
              d={line.d}
              stroke={color}
              strokeWidth={3.4}
              strokeLinecap="round"
              fill="none"
              opacity={line.o}
            />
          ))}
        </G>
      );

    default:
      return <Cloud color={color} />;
  }
}

/** Per-condition idle motion for the hero icon. */
function motionFor(condition: WeatherCondition, isDay: boolean) {
  if (condition === 'clear' && isDay) {
    return {
      animationName: {
        '0%': { transform: [{ rotate: '0deg' }] },
        '100%': { transform: [{ rotate: '360deg' }] },
      },
      animationDuration: 34_000,
      animationIterationCount: 'infinite' as const,
      animationTimingFunction: 'linear' as const,
    };
  }

  if (condition === 'wind' || condition === 'haze') {
    return {
      animationName: {
        '0%': { transform: [{ translateX: -2 }] },
        '50%': { transform: [{ translateX: 3 }] },
        '100%': { transform: [{ translateX: -2 }] },
      },
      animationDuration: 3400,
      animationIterationCount: 'infinite' as const,
      animationTimingFunction: 'ease-in-out' as const,
    };
  }

  // Everything else breathes: a slow bob that suggests weight without noise.
  return {
    animationName: {
      '0%': { transform: [{ translateY: 0 }, { scale: 1 }] },
      '50%': { transform: [{ translateY: -3 }, { scale: 1.03 }] },
      '100%': { transform: [{ translateY: 0 }, { scale: 1 }] },
    },
    animationDuration: 5200,
    animationIterationCount: 'infinite' as const,
    animationTimingFunction: 'ease-in-out' as const,
  };
}

export const WeatherIcon = memo(function WeatherIcon({
  condition,
  size = 40,
  isDay = true,
  color = '#FFFFFF',
  accent,
  animated = false,
}: WeatherIconProps) {
  const strokeAccent = accent ?? (condition === 'clear' || condition === 'haze' ? '#FFD66B' : '#BFE4FF');
  const body = <Svg width={size} height={size} viewBox="0 0 64 68">{glyph(condition, isDay, color, strokeAccent)}</Svg>;

  if (!animated) return <View style={{ width: size, height: size }}>{body}</View>;

  return (
    <Animated.View style={{ width: size, height: size, ...motionFor(condition, isDay) }}>{body}</Animated.View>
  );
});
