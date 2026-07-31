import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Glass, Ink, Radius, Space, Type } from '@/design/tokens';
import { SkyText } from './sky-text';

/**
 * Selection controls.
 *
 * Chips and segments both animate their own press feedback rather than relying
 * on a ripple, so they feel the same on both platforms and over any sky.
 */

export const Chip = memo(function Chip({
  label,
  selected,
  onPress,
  leading,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
  leading?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        { transform: [{ scale: pressed ? 0.95 : 1 }] },
      ]}>
      {leading}
      <SkyText style={[Type.bodySmall, { color: selected ? Ink.primary : Ink.secondary }]}>
        {label}
      </SkyText>
    </Pressable>
  );
});

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange(next: T): void;
}) {
  return (
    <View style={styles.segments}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.selectionAsync();
              onChange(option.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <SkyText
              style={[
                Type.caption,
                { color: selected ? Ink.primary : Ink.tertiary, textAlign: 'center' },
              ]}>
              {option.label}
            </SkyText>
          </Pressable>
        );
      })}
    </View>
  );
}

export const Toggle = memo(function Toggle({
  label,
  value,
  onChange,
  description,
}: {
  label: string;
  value: boolean;
  onChange(next: boolean): void;
  description?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') void Haptics.selectionAsync();
        onChange(!value);
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <SkyText style={Type.body}>{label}</SkyText>
        {description ? (
          <SkyText style={[Type.caption, { color: Ink.tertiary }]}>{description}</SkyText>
        ) : null}
      </View>

      <Animated.View
        style={[
          styles.track,
          value && styles.trackOn,
          { transitionProperty: 'backgroundColor', transitionDuration: 200 },
        ]}>
        <Animated.View
          style={[
            styles.knob,
            {
              transform: [{ translateX: value ? 20 : 0 }],
              transitionProperty: 'transform',
              transitionDuration: 220,
              transitionTimingFunction: 'ease-out',
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xxs,
    paddingHorizontal: Space.sm,
    paddingVertical: Space.xs,
    borderRadius: Radius.pill,
    backgroundColor: Glass.fillSubtle,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: Glass.border,
  },
  chipSelected: {
    backgroundColor: Glass.fillStrong,
    borderColor: Glass.borderStrong,
  },
  segments: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: Radius.md,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: Space.xs,
    borderRadius: Radius.sm,
  },
  segmentSelected: {
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: Space.xs,
  },
  track: {
    width: 50,
    height: 30,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
    padding: 3,
    justifyContent: 'center',
  },
  trackOn: {
    backgroundColor: 'rgba(127,210,255,0.55)',
  },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
});
