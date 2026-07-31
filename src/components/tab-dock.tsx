/*
 * eslint-disable react-hooks/immutability
 *
 * The React Compiler's immutability rule freezes any value a hook has already
 * captured. Reanimated shared values are mutable refs by design, and this dock
 * mutates the same ones from three places — the pan gesture, the tap handler,
 * and the effect that syncs with external navigation. No ordering satisfies the
 * rule once more than one hook writes to a shared value, so it is switched off
 * here rather than worked around. Everything else in `react-hooks` stays on.
 */
/* eslint-disable react-hooks/immutability */

import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import { Glass, Ink, Radius, Space, Type } from '@/design/tokens';
import { SkyText } from './ui/sky-text';

/**
 * Floating tab dock.
 *
 * A pill that hovers over the sky rather than a bar that cuts it off — the
 * background stays continuous to the bottom of the screen, which is the point
 * of a full-bleed weather simulation.
 *
 * Selection can be tapped *or dragged*: press anywhere on the dock and slide,
 * and the indicator tracks your finger continuously, snapping to the nearest
 * slot on release. The whole interaction runs on the UI thread from one shared
 * `position` value expressed in fractional slots, so the indicator never lags
 * behind the gesture. Only slot *crossings* cross back to JS — for the haptic
 * tick and the label highlight — which is two or three calls per drag rather
 * than one per frame.
 */

/** Horizontal travel before the pan takes over, so taps still register. */
const DRAG_THRESHOLD = 8;

const SPRING = { damping: 18, stiffness: 220, mass: 0.6 };

/**
 * Dock inner padding. A plain constant rather than a read through `styles`,
 * because the pan worklet needs it and capturing a StyleSheet object inside a
 * worklet is needlessly fragile.
 */
const DOCK_PADDING = 4;

type IconProps = { active: boolean };

function TodayIcon({ active }: IconProps) {
  const color = active ? Ink.primary : Ink.tertiary;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Circle cx={12} cy={10} r={4.4} fill={active ? '#FFD66B' : color} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <Path
            key={deg}
            d={`M ${12 + Math.cos(rad) * 6.6} ${10 + Math.sin(rad) * 6.6} L ${12 + Math.cos(rad) * 8.6} ${
              10 + Math.sin(rad) * 8.6
            }`}
            stroke={active ? '#FFD66B' : color}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
}

function CitiesIcon({ active }: IconProps) {
  const color = active ? Ink.primary : Ink.tertiary;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M4 20 V10 L10 6 V20 M10 20 V12 L18 8 V20"
        stroke={color}
        strokeWidth={1.9}
        strokeLinejoin="round"
        strokeLinecap="round"
        fill={active ? 'rgba(255,255,255,0.18)' : 'none'}
      />
      <Path d="M2.5 20 H21.5" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
    </Svg>
  );
}

function SkyIcon({ active }: IconProps) {
  const color = active ? Ink.primary : Ink.tertiary;
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path
        d="M12 2.5 L13.7 8.3 L19.5 10 L13.7 11.7 L12 17.5 L10.3 11.7 L4.5 10 L10.3 8.3 Z"
        fill={active ? '#B7A2FF' : color}
      />
      <Circle cx={18.5} cy={17.5} r={2.1} fill={active ? '#7FD2FF' : color} />
      <Circle cx={5.5} cy={16} r={1.4} fill={color} opacity={0.7} />
    </Svg>
  );
}

const ICONS: Record<string, (props: IconProps) => React.ReactElement> = {
  index: TodayIcon,
  cities: CitiesIcon,
  sky: SkyIcon,
};

const LABELS: Record<string, string> = {
  index: 'Today',
  cities: 'Cities',
  sky: 'Sky',
};

/**
 * One slot. Split into its own component because its highlight is derived from
 * the shared drag position with a hook, which can't live inside a `.map`.
 */
const DockSlot = memo(function DockSlot({
  index,
  position,
  routeName,
  highlighted,
  onPress,
}: {
  index: number;
  position: SharedValue<number>;
  routeName: string;
  highlighted: boolean;
  onPress(): void;
}) {
  const Icon = ICONS[routeName] ?? TodayIcon;
  const label = LABELS[routeName] ?? routeName;

  // Swells as the indicator approaches, so the dock responds continuously
  // through a drag instead of only at the moment of commit.
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(position.value - index);
    return {
      opacity: interpolate(distance, [0, 1], [1, 0.6], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(distance, [0, 1], [1.06, 1], Extrapolation.CLAMP) }],
    };
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: highlighted }}
      accessibilityLabel={label}
      style={styles.slot}>
      <Animated.View style={[styles.slotInner, animatedStyle]}>
        <Icon active={highlighted} />
        <SkyText style={[Type.label, { color: highlighted ? Ink.primary : Ink.quaternary, fontSize: 9.5 }]}>
          {label.toUpperCase()}
        </SkyText>
      </Animated.View>
    </Pressable>
  );
});

export const TabDock = memo(function TabDock({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [slotWidth, setSlotWidth] = useState(0);
  /** Slot under the finger mid-drag; null when not dragging. */
  const [preview, setPreview] = useState<number | null>(null);

  const routeCount = state.routes.length;
  const lastIndex = routeCount - 1;

  /** Indicator location, in fractional slots. */
  const position = useSharedValue(state.index);
  /** Instant 0/1 flag for logic. */
  const dragging = useSharedValue(0);
  /** Spring-eased 0–1 companion, driving only the visual lift. */
  const lift = useSharedValue(0);
  // Mirrored into shared values so the gesture worklets read current layout
  // without the gesture object having to be rebuilt.
  const slotWidthShared = useSharedValue(0);
  const crossedIndex = useSharedValue(state.index);

  const tick = useCallback(() => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
  }, []);

  const select = useCallback(
    (index: number) => {
      setPreview(null);
      const route = state.routes[index];
      if (!route) return;

      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (state.index !== index && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    },
    [navigation, state.routes, state.index],
  );

  const onCross = useCallback(
    (index: number) => {
      setPreview(index);
      tick();
    },
    [tick],
  );

  /** Tap on a slot: spring straight to it, then commit. */
  const handleSlotPress = useCallback(
    (index: number) => {
      position.value = withSpring(index, SPRING);
      crossedIndex.value = index;
      select(index);
    },
    [select, position, crossedIndex],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Only claim the gesture once it is clearly a horizontal drag; below
        // this threshold the touch stays with the Pressables underneath.
        .activeOffsetX([-DRAG_THRESHOLD, DRAG_THRESHOLD])
        .failOffsetY([-14, 14])
        .onBegin(() => {
          dragging.value = 1;
          lift.value = withSpring(1, SPRING);
        })
        .onUpdate((event) => {
          const slot = slotWidthShared.value;
          if (slot <= 0) return;

          // `event.x` is relative to the dock, which is inset by its padding.
          const raw = (event.x - DOCK_PADDING - slot / 2) / slot;
          position.value = Math.min(lastIndex, Math.max(0, raw));

          const nearest = Math.round(position.value);
          if (nearest !== crossedIndex.value) {
            crossedIndex.value = nearest;
            runOnJS(onCross)(nearest);
          }
        })
        .onEnd(() => {
          const target = Math.min(lastIndex, Math.max(0, Math.round(position.value)));
          position.value = withSpring(target, SPRING);
          runOnJS(select)(target);
        })
        .onFinalize(() => {
          dragging.value = 0;
          lift.value = withSpring(0, SPRING);
          crossedIndex.value = Math.round(position.value);
        }),
    [lastIndex, onCross, select, dragging, lift, position, slotWidthShared, crossedIndex],
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    width: slotWidth,
    transform: [
      { translateX: position.value * slotWidth },
      // Reads `lift` rather than starting a spring here: this worklet re-runs
      // on every frame of a drag, and beginning an animation inside it would
      // restart that animation continuously.
      { scale: 1 + lift.value * 0.06 },
    ],
  }));

  // Follow navigation that happened elsewhere — the Cities screen pushes to
  // Today, and the indicator has to agree. Skipped mid-drag so it can't fight
  // the finger.
  useEffect(() => {
    if (dragging.value === 0) position.value = withSpring(state.index, SPRING);
  }, [state.index, dragging, position]);

  const highlighted = preview ?? state.index;

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, Space.sm), pointerEvents: 'box-none' },
      ]}>
      <GestureDetector gesture={pan}>
        <View
          style={styles.dock}
          onLayout={(event) => {
            const inner = event.nativeEvent.layout.width - DOCK_PADDING * 2;
            const next = inner / Math.max(1, routeCount);
            setSlotWidth(next);
            slotWidthShared.value = next;
          }}>
          <LinearGradient
            colors={Glass.sheen as unknown as readonly [string, string]}
            locations={[0, 0.6]}
            style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
          />

          {slotWidth > 0 && (
            <Animated.View style={[styles.indicator, indicatorStyle, { pointerEvents: 'none' }]}>
              <LinearGradient
                colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0.12)']}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}

          {state.routes.map((route, index) => (
            <DockSlot
              key={route.key}
              index={index}
              position={position}
              routeName={route.name}
              highlighted={highlighted === index}
              onPress={() => handleSlotPress(index)}
            />
          ))}
        </View>
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Space.lg,
  },
  dock: {
    flexDirection: 'row',
    borderRadius: Radius.xl,
    backgroundColor: 'rgba(12,20,34,0.42)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: Glass.border,
    padding: DOCK_PADDING,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: DOCK_PADDING,
    bottom: DOCK_PADDING,
    left: DOCK_PADDING,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  slot: {
    flex: 1,
    paddingVertical: 9,
  },
  slotInner: {
    alignItems: 'center',
    gap: 3,
  },
});
