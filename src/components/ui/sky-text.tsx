import { memo } from 'react';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Ink } from '@/design/tokens';

/**
 * Text over the sky.
 *
 * Content always sits on a moving, sometimes bright background, so every string
 * gets a soft shadow by default. It costs nothing and is the difference between
 * legible and unreadable when the sun drifts behind the hero temperature.
 *
 * The shadow is expressed two ways because the platforms disagree: react-native
 * -web has deprecated the `textShadow*` longhands in favour of the CSS
 * shorthand, while native only understands the longhands.
 */
const shadow = Platform.select({
  web: { textShadow: '0px 1px 8px rgba(4,10,22,0.35)' },
  default: {
    textShadowColor: 'rgba(4,10,22,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
}) as TextProps['style'];

const styles = StyleSheet.create({
  base: { color: Ink.primary },
});

export const SkyText = memo(function SkyText({ style, ...rest }: TextProps) {
  return <Text style={[styles.base, shadow, style]} {...rest} />;
});
