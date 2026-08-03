import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Glass, Ink, Radius, Space, Type } from '@/design/tokens';
import type { WeatherError } from '@/weather/provider';
import { GlassPanel } from './ui/glass';
import { SkyText } from './ui/sky-text';

/**
 * Failure state with a way out.
 *
 * The message is written from the error's `kind` rather than surfaced raw: a
 * provider's exception text is written for a developer, and "Aborted" or
 * "Request failed with status 503" tells a user nothing about what to do next.
 */

const COPY: Record<WeatherError['kind'], { title: string; detail: string }> = {
  network: {
    title: 'No connection',
    detail: 'Check your network and try again — saved cities are still here.',
  },
  'not-found': {
    title: "Couldn't find that place",
    detail: 'The location may no longer be available from this weather source.',
  },
  'rate-limited': {
    title: 'Too many requests',
    detail: 'The weather service is throttling us. Give it a moment.',
  },
  unknown: {
    title: "Couldn't load the forecast",
    detail: 'Something went wrong fetching this location.',
  },
};

export const ErrorState = memo(function ErrorState({
  kind = 'unknown',
  placeName,
  onRetry,
  retrying,
}: {
  kind?: WeatherError['kind'];
  placeName: string;
  onRetry(): void;
  retrying?: boolean;
}) {
  const copy = COPY[kind] ?? COPY.unknown;

  const handleRetry = () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onRetry();
  };

  return (
    <GlassPanel style={styles.panel}>
      <View style={styles.icon}>
        <Svg width={26} height={26} viewBox="0 0 24 24">
          <Path
            d="M4 15 a4 4 0 0 1 1 -7.9 a5.5 5.5 0 0 1 10.5 -1.2 A4.5 4.5 0 0 1 20 15 Z"
            stroke={Ink.secondary}
            strokeWidth={1.8}
            strokeLinejoin="round"
            fill="none"
          />
          <Path d="M9 19 L15 19" stroke={Ink.quaternary} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </View>

      <SkyText style={Type.heading}>{copy.title}</SkyText>
      <SkyText style={[Type.bodySmall, styles.detail]}>{copy.detail}</SkyText>
      <SkyText style={[Type.caption, { color: Ink.quaternary }]}>{placeName}</SkyText>

      <Pressable
        onPress={handleRetry}
        disabled={retrying}
        accessibilityRole="button"
        accessibilityLabel={`Retry loading weather for ${placeName}`}
        style={({ pressed }) => [styles.button, { opacity: pressed || retrying ? 0.6 : 1 }]}>
        <SkyText style={[Type.bodySmall, { fontWeight: '700' }]}>
          {retrying ? 'Retrying…' : 'Try again'}
        </SkyText>
      </Pressable>
    </GlassPanel>
  );
});

const styles = StyleSheet.create({
  panel: {
    alignItems: 'center',
    gap: Space.xs,
    padding: Space.lg,
    marginTop: Space.xl,
  },
  icon: {
    marginBottom: Space.xxs,
  },
  detail: {
    color: Ink.secondary,
    textAlign: 'center',
  },
  button: {
    marginTop: Space.sm,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderRadius: Radius.pill,
    backgroundColor: Glass.fillStrong,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: Glass.borderStrong,
  },
});
