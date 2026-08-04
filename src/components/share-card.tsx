import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { memo, useCallback, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Svg, { Path } from 'react-native-svg';

import { Glass, Ink, Radius, Space, Type } from '@/design/tokens';
import { getPalette } from '@/sky/palettes';
import type { SkyState } from '@/sky/types';
import { convertTemperature, formatDate, formatPlace } from '@/weather/format';
import { CONDITION_LABEL, type CurrentWeather, type DailyForecast, type Place, type TemperatureUnit } from '@/weather/types';
import { SkyText } from './ui/sky-text';
import { WeatherIcon } from './weather-icon';

/**
 * Shareable weather card.
 *
 * The card is rendered off-screen rather than by screenshotting the live view:
 * capturing the real screen would catch the animated sky mid-frame, whatever
 * happened to be scrolled into place, and the tab dock. A purpose-built card at
 * a fixed size is reproducible, and it composes without motion so the capture
 * never lands on a half-drawn raindrop.
 */

const CARD_WIDTH = 340;
const CARD_HEIGHT = 440;

export type ShareCardProps = {
  place: Place;
  current: CurrentWeather;
  today?: DailyForecast;
  sky: SkyState;
  unit: TemperatureUnit;
};

/** The card itself. Positioned off-screen; only ever seen via the capture. */
const Card = memo(function Card({ place, current, today, sky, unit }: ShareCardProps) {
  const palette = getPalette(sky.condition, sky.dayPart);

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={palette.colors as unknown as readonly [string, string, ...string[]]}
        locations={palette.locations as unknown as readonly [number, number, ...number[]] | undefined}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)']}
        locations={[0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.cardTop}>
        <SkyText style={[Type.label, { color: Ink.tertiary }]}>
          {formatDate(current.observedAt, place.utcOffsetMinutes).toUpperCase()}
        </SkyText>
        <SkyText style={Type.title} numberOfLines={1}>
          {formatPlace(place)}
        </SkyText>
      </View>

      <View style={styles.cardMiddle}>
        <WeatherIcon condition={current.condition} isDay={current.isDay} size={92} />
        <View style={styles.cardTempRow}>
          <SkyText style={styles.cardTemp}>
            {Math.round(convertTemperature(current.temperature, unit))}
          </SkyText>
          <SkyText style={styles.cardDegree}>°{unit.toUpperCase()}</SkyText>
        </View>
        <SkyText style={[Type.body, { color: Ink.secondary }]}>
          {CONDITION_LABEL[current.condition]}
        </SkyText>
      </View>

      <View style={styles.cardBottom}>
        {today && (
          <SkyText style={[Type.bodySmall, { color: Ink.secondary }]}>
            H {Math.round(convertTemperature(today.temperatureMax, unit))}° · L{' '}
            {Math.round(convertTemperature(today.temperatureMin, unit))}°
          </SkyText>
        )}
        <SkyText style={[Type.label, { color: Ink.quaternary }]}>AURORA</SkyText>
      </View>
    </View>
  );
});

export const ShareButton = memo(function ShareButton(props: ShareCardProps) {
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const onShare = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (!(await Sharing.isAvailableAsync())) return;

      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `Weather in ${props.place.name}`,
        UTI: 'public.png',
      });
    } catch {
      // Cancelled, or capture unsupported on this platform. Nothing to say —
      // the user either dismissed it or never saw a sheet.
    } finally {
      setBusy(false);
    }
  }, [busy, props.place.name]);

  return (
    <>
      <Pressable
        onPress={onShare}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Share the weather in ${props.place.name}`}
        style={({ pressed }) => [styles.button, { opacity: pressed || busy ? 0.6 : 1 }]}>
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path
            d="M12 16 V4 M8 7.5 L12 3.5 L16 7.5"
            stroke={Ink.secondary}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d="M5 14 v5 a1 1 0 0 0 1 1 h12 a1 1 0 0 0 1 -1 v-5"
            stroke={Ink.secondary}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
        <SkyText style={[Type.bodySmall, { color: Ink.secondary }]}>
          {busy ? 'Preparing…' : 'Share'}
        </SkyText>
      </Pressable>

      {/*
       * Off-screen, not `display: none` — a hidden view has no layout and
       * captures as blank. Parked well outside the viewport instead.
       */}
      <View style={styles.offscreen} pointerEvents="none">
        <View ref={cardRef} collapsable={false}>
          <Card {...props} />
        </View>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.xs,
    alignSelf: 'center',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderRadius: Radius.pill,
    backgroundColor: Glass.fillSubtle,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: Glass.border,
  },
  offscreen: {
    position: 'absolute',
    left: -9999,
    top: -9999,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    padding: Space.lg,
    justifyContent: 'space-between',
  },
  cardTop: {
    gap: 2,
  },
  cardMiddle: {
    alignItems: 'center',
    gap: Space.xs,
  },
  cardTempRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardTemp: {
    fontSize: 96,
    fontWeight: '200',
    letterSpacing: -5,
    lineHeight: 104,
  },
  cardDegree: {
    fontSize: 26,
    fontWeight: '300',
    marginTop: 14,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
