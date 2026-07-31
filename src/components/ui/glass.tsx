import { LinearGradient } from 'expo-linear-gradient';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { Glass, Ink, Radius, Space, Type } from '@/design/tokens';
import { SkyText } from './sky-text';

/**
 * The app's only surface primitive.
 *
 * A panel is a translucent fill, a hairline border, and a sheen gradient along
 * the top edge — the three things that make a plane read as glass. The sheen is
 * what stops it looking like a flat grey rectangle over a bright sky.
 */

export type GlassPanelProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Visual weight against the sky. */
  tone?: 'subtle' | 'default' | 'strong';
  radius?: number;
  /** Entrance animation index — panels cascade in on mount. */
  index?: number;
  animateIn?: boolean;
};

export const GlassPanel = memo(function GlassPanel({
  children,
  style,
  tone = 'default',
  radius = Radius.lg,
  index = 0,
  animateIn = true,
}: GlassPanelProps) {
  const fill = tone === 'strong' ? Glass.fillStrong : tone === 'subtle' ? Glass.fillSubtle : Glass.fill;
  const border = tone === 'strong' ? Glass.borderStrong : Glass.border;

  return (
    <Animated.View
      style={[
        {
          backgroundColor: fill,
          borderRadius: radius,
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: border,
          overflow: 'hidden',
        },
        animateIn
          ? {
              opacity: 0,
              animationName: {
                from: { opacity: 0, transform: [{ translateY: 22 }, { scale: 0.97 }] },
                to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
              },
              animationDuration: 620,
              // Cascade, capped so a long list never feels like it is loading.
              animationDelay: Math.min(index * 70, 560),
              animationFillMode: 'forwards' as const,
              animationTimingFunction: 'ease-out' as const,
            }
          : null,
        style,
      ]}>
      <LinearGradient
        colors={Glass.sheen as unknown as readonly [string, string]}
        locations={[0, 0.55]}
        style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}
      />
      {children}
    </Animated.View>
  );
});

/** Panel with the standard section header treatment. */
export const GlassSection = memo(function GlassSection({
  title,
  accessory,
  children,
  style,
  contentStyle,
  index,
}: {
  title: string;
  accessory?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  index?: number;
}) {
  return (
    <GlassPanel style={style} index={index}>
      <View style={styles.header}>
        <SkyText style={[Type.label, { color: Ink.tertiary }]}>{title.toUpperCase()}</SkyText>
        {accessory}
      </View>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </GlassPanel>
  );
});

export const GlassDivider = memo(function GlassDivider({ inset = 0 }: { inset?: number }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255,255,255,0.14)',
        marginLeft: inset,
      }}
    />
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.md,
    paddingTop: Space.md,
    paddingBottom: Space.xs,
  },
  content: {
    paddingBottom: Space.md,
  },
});
