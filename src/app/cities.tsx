import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { GlassPanel } from '@/components/ui/glass';
import { SkyText } from '@/components/ui/sky-text';
import { WeatherIcon } from '@/components/weather-icon';
import { DOCK_HEIGHT, DOCK_MARGIN, Glass, Ink, Radius, Space, Type } from '@/design/tokens';
import { SkyBackground } from '@/sky/sky-background';
import { useNow, useSkyState } from '@/sky/use-sky';
import { weatherProvider } from '@/weather';
import { convertTemperature, formatClock, formatPlace } from '@/weather/format';
import { useWeatherStore } from '@/weather/store';
import type { Place, TemperatureUnit } from '@/weather/types';

/**
 * Saved cities.
 *
 * Each row is a live window onto that city's weather, not a static thumbnail —
 * it is raining inside the London card. Card skies run at the lowest quality
 * tier, so five simultaneous simulations cost about as much as one full-screen
 * one.
 */

const CARD_HEIGHT = 116;

const CityCard = memo(function CityCard({
  place,
  unit,
  use24Hour,
  index,
  active,
  onPress,
  onRemove,
  canRemove,
}: {
  place: Place;
  unit: TemperatureUnit;
  use24Hour: boolean;
  index: number;
  active: boolean;
  onPress(): void;
  onRemove(): void;
  canRemove: boolean;
}) {
  const { width } = useWindowDimensions();
  const { entries, preferences } = useWeatherStore();
  const snapshot = entries[place.id]?.snapshot;
  const sky = useSkyState(snapshot);
  const now = useNow(30_000);

  const cardWidth = width - Space.lg * 2;
  const today = snapshot?.daily[0];

  return (
    <Animated.View
      style={{
        opacity: 0,
        animationName: {
          from: { opacity: 0, transform: [{ translateY: 24 }, { scale: 0.97 }] },
          to: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] },
        },
        animationDuration: 560,
        animationDelay: Math.min(index * 80, 480),
        animationFillMode: 'forwards',
        animationTimingFunction: 'ease-out',
      }}>
      <Pressable
        onPress={onPress}
        onLongPress={canRemove ? onRemove : undefined}
        accessibilityRole="button"
        accessibilityLabel={`${formatPlace(place)}${active ? ', current city' : ''}`}
        style={({ pressed }) => [
          styles.card,
          { height: CARD_HEIGHT, transform: [{ scale: pressed ? 0.985 : 1 }] },
          active && styles.cardActive,
        ]}>
        {/* The card's own weather, clipped to its bounds. */}
        <View style={StyleSheet.absoluteFill}>
          <SkyBackground
            state={sky}
            width={cardWidth}
            height={CARD_HEIGHT}
            quality="battery"
            motion={preferences.motionEnabled}
          />
        </View>

        <View style={styles.cardContent}>
          <View style={styles.cardLeft}>
            <SkyText style={Type.heading} numberOfLines={1}>
              {place.name}
            </SkyText>
            <SkyText style={[Type.caption, { color: Ink.secondary }]}>
              {formatClock(now, place.utcOffsetMinutes, use24Hour)} · {place.country}
            </SkyText>
            {snapshot && (
              <SkyText style={[Type.caption, { color: Ink.tertiary }]} numberOfLines={1}>
                {snapshot.current.summary}
              </SkyText>
            )}
          </View>

          <View style={styles.cardRight}>
            {snapshot ? (
              <>
                <View style={styles.cardTempRow}>
                  <WeatherIcon
                    condition={snapshot.current.condition}
                    isDay={snapshot.current.isDay}
                    size={28}
                  />
                  <SkyText style={styles.cardTemp}>
                    {Math.round(convertTemperature(snapshot.current.temperature, unit))}°
                  </SkyText>
                </View>
                {today && (
                  <SkyText style={[Type.caption, { color: Ink.secondary }]}>
                    H {Math.round(convertTemperature(today.temperatureMax, unit))}° L{' '}
                    {Math.round(convertTemperature(today.temperatureMin, unit))}°
                  </SkyText>
                )}
              </>
            ) : (
              <SkyText style={[Type.caption, { color: Ink.tertiary }]}>Loading…</SkyText>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

export default function CitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { places, activePlaceId, entries, preferences, setActivePlaceId, addPlace, removePlace } =
    useWeatherStore();

  const [query, setQuery] = useState('');
  // Results are stored with the query that produced them. Deriving visibility
  // from that comparison means clearing the field needs no state update at all,
  // and stale hits from a previous query can never flash on screen.
  const [results, setResults] = useState<{ query: string; places: Place[] }>({
    query: '',
    places: [],
  });

  const trimmedQuery = query.trim();
  const visibleResults = results.query === trimmedQuery ? results.places : [];
  const searching = trimmedQuery.length > 0 && results.query !== trimmedQuery;

  // The backdrop for this screen follows whichever city is currently active.
  const activeSky = useSkyState(entries[activePlaceId]?.snapshot);

  useEffect(() => {
    if (!trimmedQuery) return;

    // Debounced so typing doesn't fire a request per keystroke. Every state
    // update happens inside the timer callback, never in the effect body.
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const found = await weatherProvider.searchPlaces(trimmedQuery, controller.signal);
        setResults({
          query: trimmedQuery,
          places: found.filter((place) => !places.some((p) => p.id === place.id)),
        });
      } catch {
        // Aborted or offline — leave the previous results alone.
      }
    }, 260);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery, places]);

  const handleSelect = useCallback(
    (id: string) => {
      if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setActivePlaceId(id);
      router.push('/');
    },
    [router, setActivePlaceId],
  );

  const handleRemove = useCallback(
    (id: string) => {
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      removePlace(id);
    },
    [removePlace],
  );

  const handleAdd = useCallback(
    (place: Place) => {
      if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addPlace(place);
      setQuery('');
    },
    [addPlace],
  );

  const emptyMessage = useMemo(() => {
    if (searching) return 'Searching…';
    if (trimmedQuery && !visibleResults.length) return 'No matches';
    return null;
  }, [searching, trimmedQuery, visibleResults.length]);

  return (
    <View style={styles.root}>
      <SkyBackground
        state={activeSky}
        width={width}
        height={height}
        quality={preferences.quality}
        motion={preferences.motionEnabled}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Space.md,
            paddingBottom: insets.bottom + DOCK_HEIGHT + DOCK_MARGIN + Space.xl,
          },
        ]}>
        <SkyText style={Type.title}>Cities</SkyText>

        <GlassPanel radius={Radius.pill} style={styles.search} animateIn={false}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path
              d="M11 4 a7 7 0 1 0 0 14 a7 7 0 1 0 0 -14 M16.5 16.5 L21 21"
              stroke={Ink.tertiary}
              strokeWidth={2}
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Add a city"
            placeholderTextColor={Ink.quaternary}
            style={styles.searchInput}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search for a city to add"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
              <SkyText style={[Type.body, { color: Ink.tertiary }]}>✕</SkyText>
            </Pressable>
          )}
        </GlassPanel>

        {emptyMessage && (
          <SkyText style={[Type.bodySmall, { color: Ink.tertiary, paddingHorizontal: Space.xs }]}>
            {emptyMessage}
          </SkyText>
        )}

        {visibleResults.map((place, index) => (
          <Animated.View
            key={place.id}
            style={{
              opacity: 0,
              animationName: {
                from: { opacity: 0, transform: [{ translateY: -10 }] },
                to: { opacity: 1, transform: [{ translateY: 0 }] },
              },
              animationDuration: 340,
              animationDelay: index * 45,
              animationFillMode: 'forwards',
              animationTimingFunction: 'ease-out',
            }}>
            <Pressable onPress={() => handleAdd(place)} style={styles.result}>
              <View style={{ flex: 1 }}>
                <SkyText style={Type.body}>{formatPlace(place)}</SkyText>
                <SkyText style={[Type.caption, { color: Ink.tertiary }]}>{place.country}</SkyText>
              </View>
              <SkyText style={[Type.heading, { color: Ink.secondary }]}>+</SkyText>
            </Pressable>
          </Animated.View>
        ))}

        {places.map((place, index) => (
          <CityCard
            key={place.id}
            place={place}
            unit={preferences.unit}
            use24Hour={preferences.use24Hour}
            index={index}
            active={place.id === activePlaceId}
            canRemove={places.length > 1}
            onPress={() => handleSelect(place.id)}
            onRemove={() => handleRemove(place.id)}
          />
        ))}

        <SkyText style={[Type.caption, styles.hint]}>Long-press a city to remove it</SkyText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Space.lg,
    gap: Space.sm,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
    paddingHorizontal: Space.md,
    paddingVertical: Platform.select({ ios: 12, default: 4 }),
    marginBottom: Space.xxs,
  },
  searchInput: {
    flex: 1,
    color: Ink.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radius.md,
    backgroundColor: Glass.fillSubtle,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: Glass.border,
  },
  card: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: Glass.border,
    justifyContent: 'center',
  },
  cardActive: {
    borderColor: Glass.borderStrong,
    borderWidth: 1.5,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.md,
    gap: Space.sm,
  },
  cardLeft: {
    flex: 1,
    gap: 2,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  cardTempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xxs,
  },
  cardTemp: {
    fontSize: 38,
    fontWeight: '300',
    letterSpacing: -1.5,
    color: Ink.primary,
  },
  hint: {
    textAlign: 'center',
    color: Ink.quaternary,
    marginTop: Space.xs,
  },
});
