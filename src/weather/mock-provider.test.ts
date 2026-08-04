import { DIRECTORY } from './directory';
import { mockProvider } from './mock-provider';
import type { Place } from './types';

/**
 * Tests for the generated climate.
 *
 * These exist because of two bugs that shipped and were only caught by eye:
 * Ooty reported 28°C because elevation was ignored, and a straight-line
 * latitude curve was ~10°C too warm near the poles. Both were in pure
 * functions, both produced entirely plausible-looking output, and neither
 * would have survived the assertions below.
 */

jest.setTimeout(30_000);

function place(id: string): Place {
  const found = DIRECTORY.find((entry) => entry.id === id);
  if (!found) throw new Error(`Fixture missing from directory: ${id}`);
  return found;
}

/** Mean of the next 24 hours, which smooths the diurnal swing out. */
async function meanTemperature(target: Place) {
  const snapshot = await mockProvider.getSnapshot(target);
  const day = snapshot.hourly.slice(0, 24);
  return day.reduce((sum, hour) => sum + hour.temperature, 0) / day.length;
}

describe('generated climate', () => {
  it('is far cooler on a hill station than on the plain at the same latitude', async () => {
    // Ooty (2240m) and Coimbatore (~400m) are ~0.4° of latitude apart. The
    // difference between them is almost entirely altitude.
    const [ooty, coimbatore] = await Promise.all([
      meanTemperature(place('ooty')),
      meanTemperature(place('coimbatore')),
    ]);

    expect(coimbatore - ooty).toBeGreaterThan(6);
  });

  it('keeps hill stations in a believable range', async () => {
    for (const id of ['ooty', 'kodaikanal', 'darjeeling']) {
      const mean = await meanTemperature(place(id));
      expect(mean).toBeGreaterThan(5);
      expect(mean).toBeLessThan(25);
    }
  });

  it('keeps tropical coastal cities warm', async () => {
    for (const id of ['chennai', 'nagercoil', 'kanyakumari', 'kochi']) {
      const mean = await meanTemperature(place(id));
      expect(mean).toBeGreaterThan(20);
      expect(mean).toBeLessThan(38);
    }
  });

  it('gets colder as latitude increases', async () => {
    const [tropical, temperate, polar] = await Promise.all([
      meanTemperature(place('chennai')),
      meanTemperature(place('paris')),
      meanTemperature(place('leh')),
    ]);

    expect(tropical).toBeGreaterThan(temperate);
    expect(temperate).toBeGreaterThan(polar - 12);
  });

  it('is deterministic for the same place within a day', async () => {
    const target = place('chennai');
    const [a, b] = await Promise.all([
      mockProvider.getSnapshot(target),
      mockProvider.getSnapshot(target),
    ]);

    expect(a.hourly.map((h) => h.temperature)).toEqual(b.hourly.map((h) => h.temperature));
    expect(a.current.condition).toBe(b.current.condition);
  });

  it('produces different weather for different places', async () => {
    const [a, b] = await Promise.all([
      mockProvider.getSnapshot(place('chennai')),
      mockProvider.getSnapshot(place('leh')),
    ]);

    expect(a.hourly[0].temperature).not.toBe(b.hourly[0].temperature);
  });
});

describe('snapshot coherence', () => {
  it('works for a place the provider has never seen', async () => {
    // The original mock threw for anything outside its 14 hardcoded cities,
    // which is why no city could be added from search.
    const invented: Place = {
      id: 'invented-place',
      name: 'Nowhere',
      country: 'Testland',
      coordinates: { latitude: 42.5, longitude: 13.25 },
      timezone: 'UTC',
      utcOffsetMinutes: 60,
      elevation: 120,
    };

    const snapshot = await mockProvider.getSnapshot(invented);
    expect(snapshot.hourly).toHaveLength(48);
    expect(snapshot.daily).toHaveLength(10);
    expect(snapshot.place.id).toBe('invented-place');
  });

  it('agrees between today’s hourly data and today’s daily summary', async () => {
    const snapshot = await mockProvider.getSnapshot(place('chennai'));
    const firstDay = snapshot.daily[0];
    const temps = snapshot.hourly.slice(0, 24).map((hour) => hour.temperature);

    expect(firstDay.temperatureMax).toBeCloseTo(Math.max(...temps), 5);
    expect(firstDay.temperatureMin).toBeCloseTo(Math.min(...temps), 5);
  });

  it('keeps daily highs at or above daily lows', async () => {
    const snapshot = await mockProvider.getSnapshot(place('paris'));
    for (const day of snapshot.daily) {
      expect(day.temperatureMax).toBeGreaterThanOrEqual(day.temperatureMin);
    }
  });

  it('reports zero UV at night and positive UV by day', async () => {
    const snapshot = await mockProvider.getSnapshot(place('chennai'));

    for (const hour of snapshot.hourly) {
      if (!hour.isDay) expect(hour.uvIndex).toBe(0);
    }
    expect(snapshot.hourly.some((hour) => hour.isDay && hour.uvIndex > 0)).toBe(true);
  });

  it('returns 60 minutes of precipitation data', async () => {
    const snapshot = await mockProvider.getSnapshot(place('chennai'));

    expect(snapshot.minutely).toHaveLength(60);
    for (const minute of snapshot.minutely ?? []) {
      expect(minute.intensity).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps percentages and bearings inside their ranges', async () => {
    const snapshot = await mockProvider.getSnapshot(place('paris'));
    const { current } = snapshot;

    expect(current.humidity).toBeGreaterThanOrEqual(0);
    expect(current.humidity).toBeLessThanOrEqual(100);
    expect(current.cloudCover).toBeGreaterThanOrEqual(0);
    expect(current.cloudCover).toBeLessThanOrEqual(100);
    expect(current.windDirection).toBeGreaterThanOrEqual(0);
    expect(current.windDirection).toBeLessThanOrEqual(360);

    for (const day of snapshot.daily) {
      expect(day.precipitationChance).toBeGreaterThanOrEqual(0);
      expect(day.precipitationChance).toBeLessThanOrEqual(100);
      expect(day.moonPhase).toBeGreaterThanOrEqual(0);
      expect(day.moonPhase).toBeLessThan(1);
    }
  });
});

describe('search', () => {
  it('finds the far-southern towns the bundled directory exists for', async () => {
    for (const query of ['Nagercoil', 'Kanyakumari', 'Chennai', 'Ooty']) {
      const results = await mockProvider.searchPlaces(query);
      expect(results.length).toBeGreaterThan(0);
    }
  });

  it('matches case- and accent-insensitively', async () => {
    const lower = await mockProvider.searchPlaces('reykjavik');
    expect(lower.some((p) => p.name === 'Reykjavík')).toBe(true);
  });

  it('matches on region and country as well as name', async () => {
    const results = await mockProvider.searchPlaces('Tamil Nadu');
    expect(results.length).toBeGreaterThan(3);
  });
});
