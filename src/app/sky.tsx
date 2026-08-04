import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSection } from '@/components/ui/glass';
import { Chip, SegmentedControl, Toggle } from '@/components/ui/chips';
import { SkyText } from '@/components/ui/sky-text';
import { WeatherIcon } from '@/components/weather-icon';
import { DOCK_HEIGHT, DOCK_MARGIN, Ink, Space, Type } from '@/design/tokens';
import { getSkyRecipe } from '@/sky/derive';
import { StormRumble } from '@/sky/layers/effects';
import { SkyBackground } from '@/sky/sky-background';
import { useSkyState } from '@/sky/use-sky';
import type { SkyQuality, SkyState } from '@/sky/types';
import { useWeatherStore, type MotionPreference } from '@/weather/store';
import { ALL_CONDITIONS, CONDITION_LABEL, type DayPart, type WeatherCondition } from '@/weather/types';

/**
 * Sky.
 *
 * Every condition the renderer knows how to draw, on demand — the live weather
 * only ever shows one at a time, and a storm at 3am is not something you can
 * wait around for. Selecting anything here drives the same `SkyBackground` the
 * Today screen uses, so what you preview is exactly what ships.
 */

const DAY_PARTS: { value: DayPart; label: string }[] = [
  { value: 'dawn', label: 'Dawn' },
  { value: 'day', label: 'Day' },
  { value: 'dusk', label: 'Dusk' },
  { value: 'night', label: 'Night' },
];

const INTENSITIES = [
  { value: 0.25, label: 'Light' },
  { value: 0.6, label: 'Steady' },
  { value: 0.95, label: 'Extreme' },
];

const WINDS = [
  { value: 4, label: 'Calm' },
  { value: 22, label: 'Breezy' },
  { value: 58, label: 'Gale' },
];

/**
 * Latitude is previewable because it changes what the sky can contain — aurora
 * only exists above ~55°, and otherwise it would only ever be visible by first
 * switching to a Nordic city.
 */
const LATITUDES = [
  { value: 10, label: 'Tropical' },
  { value: 40, label: 'Temperate' },
  { value: 65, label: 'Polar' },
];

const MOTION_OPTIONS: { value: MotionPreference; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'on', label: 'Always on' },
  { value: 'off', label: 'Off' },
];

const QUALITIES: { value: SkyQuality; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'battery', label: 'Battery' },
];

export default function SkyScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { activePlace, active, preferences, motionEnabled, systemReducedMotion, setPreference } =
    useWeatherStore();

  const liveSky = useSkyState(active.snapshot);

  // `null` means "follow the real weather"; anything else is a manual preview.
  const [override, setOverride] = useState<Partial<SkyState> | null>(null);

  const sky = useMemo<SkyState>(() => ({ ...liveSky, ...override }), [liveSky, override]);
  const recipe = useMemo(() => getSkyRecipe(sky), [sky]);

  const patch = (next: Partial<SkyState>) => setOverride((prev) => ({ ...(prev ?? {}), ...next }));

  return (
    <StormRumble active={sky.condition === 'thunderstorm' && motionEnabled}>
      <View style={styles.root}>
        <SkyBackground
          state={sky}
          width={width}
          height={height}
          quality={preferences.quality}
          motion={motionEnabled}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + Space.md,
              paddingBottom: insets.bottom + DOCK_HEIGHT + DOCK_MARGIN + Space.xl,
            },
          ]}>
          <View style={styles.heading}>
            <SkyText style={Type.title}>Sky</SkyText>
            <SkyText style={[Type.bodySmall, { color: Ink.secondary }]}>
              {override
                ? `Previewing ${CONDITION_LABEL[sky.condition].toLowerCase()} · ${sky.dayPart}`
                : `Following live weather in ${activePlace.name}`}
            </SkyText>
          </View>

          <GlassSection
            title="Condition"
            index={0}
            accessory={
              override ? (
                <Chip label="Follow live" selected={false} onPress={() => setOverride(null)} />
              ) : undefined
            }
            contentStyle={styles.chipsContent}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}>
              {ALL_CONDITIONS.map((condition: WeatherCondition) => (
                <Chip
                  key={condition}
                  label={CONDITION_LABEL[condition]}
                  selected={sky.condition === condition}
                  onPress={() => patch({ condition })}
                  leading={
                    <WeatherIcon
                      condition={condition}
                      size={18}
                      isDay={sky.dayPart !== 'night'}
                      color={Ink.secondary}
                    />
                  }
                />
              ))}
            </ScrollView>
          </GlassSection>

          <GlassSection title="Time of day" index={1} contentStyle={styles.sectionContent}>
            <SegmentedControl
              options={DAY_PARTS}
              value={sky.dayPart}
              onChange={(dayPart) => patch({ dayPart })}
            />
          </GlassSection>

          <GlassSection title="Intensity" index={2} contentStyle={styles.sectionContent}>
            <SegmentedControl
              options={INTENSITIES.map((i) => ({ value: String(i.value), label: i.label }))}
              value={String(nearest(INTENSITIES.map((i) => i.value), sky.intensity))}
              onChange={(value) => patch({ intensity: Number(value) })}
            />
          </GlassSection>

          <GlassSection title="Wind" index={3} contentStyle={styles.sectionContent}>
            <SegmentedControl
              options={WINDS.map((w) => ({ value: String(w.value), label: w.label }))}
              value={String(nearest(WINDS.map((w) => w.value), sky.windSpeed))}
              onChange={(value) => patch({ windSpeed: Number(value) })}
            />
          </GlassSection>

          <GlassSection title="Latitude" index={4} contentStyle={styles.sectionContent}>
            <SegmentedControl
              options={LATITUDES.map((l) => ({ value: String(l.value), label: l.label }))}
              value={String(nearest(LATITUDES.map((l) => l.value), Math.abs(sky.latitude)))}
              onChange={(value) => patch({ latitude: Number(value) })}
            />
            <SkyText style={[Type.caption, { color: Ink.quaternary, marginTop: Space.xs }]}>
              Aurora needs a clear or partly cloudy night above 55°.
            </SkyText>
          </GlassSection>

          <GlassSection title="Active layers" index={5} contentStyle={styles.sectionContent}>
            <View style={styles.layerRow}>
              {recipe.layers.map((layer) => (
                <View key={layer} style={styles.layerPill}>
                  <SkyText style={[Type.caption, { color: Ink.secondary }]}>{layer}</SkyText>
                </View>
              ))}
            </View>
            <SkyText style={[Type.caption, { color: Ink.quaternary, marginTop: Space.xs }]}>
              Cloud cover {Math.round(recipe.cloudiness * 100)}% · darkness{' '}
              {Math.round(recipe.cloudDarkness * 100)}%
            </SkyText>
          </GlassSection>

          <GlassSection title="Performance" index={6} contentStyle={styles.sectionContent}>
            <SkyText style={[Type.caption, { color: Ink.tertiary, marginBottom: Space.xs }]}>
              Lower tiers reduce particle counts. Animation runs natively, so the cost is drawing,
              not JavaScript.
            </SkyText>
            <SegmentedControl
              options={QUALITIES}
              value={preferences.quality}
              onChange={(quality) => setPreference('quality', quality)}
            />
            <View style={{ height: Space.md }} />

            <SkyText style={[Type.label, { color: Ink.tertiary, marginBottom: Space.xxs }]}>
              ANIMATION
            </SkyText>
            <SkyText style={[Type.caption, { color: Ink.tertiary, marginBottom: Space.xs }]}>
              {systemReducedMotion
                ? 'Your device has Reduce Motion on, so Auto keeps the sky still.'
                : 'Auto follows your device’s Reduce Motion setting.'}
            </SkyText>
            <SegmentedControl
              options={MOTION_OPTIONS}
              value={preferences.motionPreference}
              onChange={(motionPreference) => setPreference('motionPreference', motionPreference)}
            />
          </GlassSection>

          <GlassSection title="Units" index={7} contentStyle={styles.sectionContent}>
            <SegmentedControl
              options={[
                { value: 'c', label: 'Celsius' },
                { value: 'f', label: 'Fahrenheit' },
              ]}
              value={preferences.unit}
              onChange={(unit) => setPreference('unit', unit)}
            />
            <View style={{ height: Space.xs }} />
            <Toggle
              label="24-hour time"
              value={preferences.use24Hour}
              onChange={(next) => setPreference('use24Hour', next)}
            />
          </GlassSection>
        </ScrollView>
      </View>
    </StormRumble>
  );
}

/** Closest option to the live value, so segments reflect real weather. */
function nearest(options: number[], value: number) {
  return options.reduce((best, option) =>
    Math.abs(option - value) < Math.abs(best - value) ? option : best,
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Space.lg,
    gap: Space.md,
  },
  heading: {
    gap: 2,
    marginBottom: Space.xxs,
  },
  chipsContent: {
    paddingHorizontal: 0,
    marginHorizontal: -Space.md,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Space.xs,
    paddingHorizontal: Space.md,
  },
  sectionContent: {
    paddingHorizontal: Space.md,
  },
  layerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.xxs,
  },
  layerPill: {
    paddingHorizontal: Space.xs,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
});
