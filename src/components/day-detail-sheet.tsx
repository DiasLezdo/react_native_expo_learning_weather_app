import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Glass, Ink, Radius, Space, temperatureColor, Type } from '@/design/tokens';
import {
  convertTemperature,
  formatClock,
  formatDate,
  formatWeekday,
  isSameLocalDay,
  uvCategory,
} from '@/weather/format';
import { CONDITION_LABEL, type DailyForecast, type HourlyForecast, type Place, type TemperatureUnit } from '@/weather/types';
import { HourlyRibbon } from './hourly-ribbon';
import { SunArc } from './metrics';
import { GlassPanel } from './ui/glass';
import { SkyText } from './ui/sky-text';
import { WeatherIcon } from './weather-icon';

/**
 * Detail for one forecast day.
 *
 * The forecast list shows ten days but the provider only returns 48 hours of
 * hourly data, so this shows an hour-by-hour ribbon for the days it exists for
 * and falls back to daily aggregates beyond that — rather than inventing hours
 * it does not have.
 */

/** Simple crescent whose terminator matches the phase, as on the sky's moon. */
const MoonGlyph = memo(function MoonGlyph({ phase, size = 34 }: { phase: number; size?: number }) {
  const illumination = 1 - Math.abs(phase - 0.5) * 2;
  const waxing = phase < 0.5;
  const r = size / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={r} cy={r} r={r - 1} fill="#F4F3EA" />
      {illumination < 0.97 && (
        <Circle
          cx={r + (1 - illumination) * size * (waxing ? -1 : 1)}
          cy={r}
          r={r - 1}
          fill="#101828"
        />
      )}
    </Svg>
  );
});

function moonPhaseLabel(phase: number) {
  if (phase < 0.03 || phase > 0.97) return 'New moon';
  if (phase < 0.22) return 'Waxing crescent';
  if (phase < 0.28) return 'First quarter';
  if (phase < 0.47) return 'Waxing gibbous';
  if (phase < 0.53) return 'Full moon';
  if (phase < 0.72) return 'Waning gibbous';
  if (phase < 0.78) return 'Last quarter';
  return 'Waning crescent';
}

const Stat = memo(function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.stat}>
      <SkyText style={[Type.label, { color: Ink.tertiary }]}>{label.toUpperCase()}</SkyText>
      <SkyText style={[Type.heading, { fontSize: 22 }]}>{value}</SkyText>
      {hint ? <SkyText style={[Type.caption, { color: Ink.quaternary }]}>{hint}</SkyText> : null}
    </View>
  );
});

export type DayDetailSheetProps = {
  day: DailyForecast;
  hourly: HourlyForecast[];
  place: Place;
  unit: TemperatureUnit;
  use24Hour: boolean;
  onClose(): void;
};

export const DayDetailSheet = memo(function DayDetailSheet({
  day,
  hourly,
  place,
  unit,
  use24Hour,
  onClose,
}: DayDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  // Only the hours belonging to this calendar day, in the place's own timezone.
  const hoursForDay = useMemo(
    () => hourly.filter((hour) => isSameLocalDay(hour.time, day.date, place.utcOffsetMinutes)),
    [hourly, day.date, place.utcOffsetMinutes],
  );

  const isToday = isSameLocalDay(day.date, Date.now(), place.utcOffsetMinutes);
  const daylightMinutes = Math.max(0, Math.round((day.sunset - day.sunrise) / 60_000));

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(180)} style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close day detail"
        />
      </Animated.View>

      <Animated.View
        entering={SlideInDown.duration(320).dampingRatio(0.9)}
        exiting={SlideOutDown.duration(240)}
        style={[styles.sheet, { maxHeight: height * 0.86, paddingBottom: insets.bottom + Space.md }]}>
        <View style={styles.grabber} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <SkyText style={Type.title}>
                {isToday ? 'Today' : formatWeekday(day.date, place.utcOffsetMinutes, true)}
              </SkyText>
              <SkyText style={[Type.bodySmall, { color: Ink.secondary }]}>
                {formatDate(day.date, place.utcOffsetMinutes)} · {place.name}
              </SkyText>
            </View>
            <WeatherIcon condition={day.condition} size={54} animated />
          </View>

          <View style={styles.range}>
            <SkyText style={[Type.display, { color: temperatureColor(day.temperatureMax) }]}>
              {Math.round(convertTemperature(day.temperatureMax, unit))}°
            </SkyText>
            <SkyText style={[Type.display, { color: Ink.tertiary, fontSize: 34 }]}>
              {Math.round(convertTemperature(day.temperatureMin, unit))}°
            </SkyText>
            <SkyText style={[Type.bodySmall, { color: Ink.secondary, flex: 1, textAlign: 'right' }]}>
              {CONDITION_LABEL[day.condition]}
            </SkyText>
          </View>

          {hoursForDay.length > 0 ? (
            <GlassPanel style={styles.section} animateIn={false}>
              <SkyText style={[Type.label, styles.sectionTitle]}>HOUR BY HOUR</SkyText>
              <View style={styles.ribbonWrap}>
                <HourlyRibbon
                  hours={hoursForDay}
                  unit={unit}
                  utcOffsetMinutes={place.utcOffsetMinutes}
                  use24Hour={use24Hour}
                />
              </View>
            </GlassPanel>
          ) : (
            <GlassPanel style={[styles.section, styles.noHourly]} animateIn={false}>
              <SkyText style={[Type.bodySmall, { color: Ink.secondary, textAlign: 'center' }]}>
                Hourly detail only reaches 48 hours ahead. Daily figures below.
              </SkyText>
            </GlassPanel>
          )}

          <View style={styles.statGrid}>
            <Stat label="Rain chance" value={`${day.precipitationChance}%`} hint={`${day.precipitation} mm expected`} />
            <Stat label="Wind" value={`${Math.round(day.windSpeed)}`} hint="km/h" />
            <Stat label="Max UV" value={`${Math.round(day.uvIndexMax)}`} hint={uvCategory(day.uvIndexMax)} />
            <Stat
              label="Daylight"
              value={`${Math.floor(daylightMinutes / 60)}h ${daylightMinutes % 60}m`}
              hint={`${formatClock(day.sunrise, place.utcOffsetMinutes, use24Hour)} – ${formatClock(
                day.sunset,
                place.utcOffsetMinutes,
                use24Hour,
              )}`}
            />
          </View>

          <GlassPanel style={styles.section} animateIn={false}>
            <SkyText style={[Type.label, styles.sectionTitle]}>SUN</SkyText>
            <View style={styles.sunWrap}>
              <SunArc
                // Today shows the live position; other days show the full path.
                progress={isToday ? clampProgress(day.sunrise, day.sunset) : 0.5}
                width={SUN_ARC_WIDTH}
                sunriseLabel={formatClock(day.sunrise, place.utcOffsetMinutes, use24Hour)}
                sunsetLabel={formatClock(day.sunset, place.utcOffsetMinutes, use24Hour)}
              />
            </View>
          </GlassPanel>

          <GlassPanel style={[styles.section, styles.moonRow]} animateIn={false}>
            <MoonGlyph phase={day.moonPhase} />
            <View style={{ flex: 1 }}>
              <SkyText style={[Type.label, { color: Ink.tertiary }]}>MOON</SkyText>
              <SkyText style={Type.body}>{moonPhaseLabel(day.moonPhase)}</SkyText>
            </View>
            <SkyText style={[Type.caption, { color: Ink.quaternary }]}>
              {Math.round((1 - Math.abs(day.moonPhase - 0.5) * 2) * 100)}% lit
            </SkyText>
          </GlassPanel>
        </ScrollView>
      </Animated.View>
    </View>
  );
});

const SUN_ARC_WIDTH = 260;

function clampProgress(sunrise: number, sunset: number, now = Date.now()) {
  return Math.min(1, Math.max(0, (now - sunrise) / Math.max(1, sunset - sunrise)));
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4,10,22,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16,26,42,0.94)',
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderColor: Glass.border,
    paddingTop: Space.xs,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginBottom: Space.sm,
  },
  content: {
    paddingHorizontal: Space.lg,
    gap: Space.sm,
    paddingBottom: Space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  range: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Space.sm,
    marginBottom: Space.xxs,
  },
  section: {
    paddingVertical: Space.md,
  },
  sectionTitle: {
    color: Ink.tertiary,
    paddingHorizontal: Space.md,
    marginBottom: Space.xs,
  },
  ribbonWrap: {
    marginHorizontal: -Space.md,
  },
  noHourly: {
    paddingHorizontal: Space.md,
  },
  sunWrap: {
    alignItems: 'center',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  stat: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: 2,
    padding: Space.md,
    borderRadius: Radius.md,
    backgroundColor: Glass.fillSubtle,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: Glass.border,
  },
  moonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.md,
  },
});
