import { computeSunTimes, dayOfYear, localHours, localMidnight, moonPhase } from './solar';

/**
 * Sunrise/sunset drives which palette the whole app renders, so an error here
 * shows up as the wrong sky rather than as a wrong number — which is exactly
 * the kind of bug nobody reports precisely.
 */

const IST = 330; // Asia/Kolkata
const UTC = 0;
const HOUR = 3_600_000;

/** Midday UTC on a given date, as a timestamp. */
function noonUtc(year: number, month: number, day: number) {
  return Date.UTC(year, month - 1, day, 12);
}

describe('localMidnight / localHours', () => {
  it('puts local midnight before the instant and exactly one day long', () => {
    const t = noonUtc(2026, 6, 15);
    const midnight = localMidnight(t, IST);

    expect(midnight).toBeLessThanOrEqual(t);
    expect(localMidnight(t + 86_400_000, IST) - midnight).toBe(86_400_000);
  });

  it('reports the place-local hour, not the device hour', () => {
    // 00:30 UTC is 06:00 in India.
    const t = Date.UTC(2026, 5, 15, 0, 30);
    expect(localHours(t, IST)).toBeCloseTo(6, 5);
    expect(localHours(t, UTC)).toBeCloseTo(0.5, 5);
  });

  it('handles offsets that are not whole hours', () => {
    // Nepal is +05:45.
    expect(localHours(Date.UTC(2026, 5, 15, 0, 15), 345)).toBeCloseTo(6, 5);
  });
});

describe('dayOfYear', () => {
  it('counts from 1 on January 1st', () => {
    expect(Math.floor(dayOfYear(noonUtc(2026, 1, 1), UTC))).toBe(1);
  });

  it('advances by one per day', () => {
    const a = Math.floor(dayOfYear(noonUtc(2026, 3, 1), UTC));
    const b = Math.floor(dayOfYear(noonUtc(2026, 3, 2), UTC));
    expect(b - a).toBe(1);
  });
});

describe('computeSunTimes', () => {
  it('gives roughly twelve hours of daylight at the equator, all year', () => {
    for (const month of [1, 4, 7, 10]) {
      const { daylightHours } = computeSunTimes(noonUtc(2026, month, 15), 0, UTC);
      expect(daylightHours).toBeGreaterThan(11.5);
      expect(daylightHours).toBeLessThan(12.5);
    }
  });

  it('puts sunrise before sunset, and both inside the local day', () => {
    const t = noonUtc(2026, 6, 15);
    const midnight = localMidnight(t, IST);
    const { sunrise, sunset } = computeSunTimes(t, 13.08, IST);

    expect(sunrise).toBeLessThan(sunset);
    expect(sunrise).toBeGreaterThanOrEqual(midnight);
    expect(sunset).toBeLessThanOrEqual(midnight + 86_400_000);
  });

  it('makes northern summer days longer than northern winter days', () => {
    const summer = computeSunTimes(noonUtc(2026, 6, 21), 51.5, UTC).daylightHours;
    const winter = computeSunTimes(noonUtc(2026, 12, 21), 51.5, UTC).daylightHours;

    expect(summer).toBeGreaterThan(15);
    expect(winter).toBeLessThan(9);
  });

  it('inverts the seasons in the southern hemisphere', () => {
    const julySouth = computeSunTimes(noonUtc(2026, 6, 21), -33.9, UTC).daylightHours;
    const decemberSouth = computeSunTimes(noonUtc(2026, 12, 21), -33.9, UTC).daylightHours;

    expect(decemberSouth).toBeGreaterThan(julySouth);
  });

  it('handles midnight sun without producing nonsense', () => {
    // Above the Arctic Circle in midsummer the sun never sets.
    const { daylightHours, sunrise, sunset } = computeSunTimes(noonUtc(2026, 6, 21), 78, UTC);

    expect(daylightHours).toBe(24);
    expect(sunset - sunrise).toBe(86_400_000);
  });

  it('handles polar night without producing nonsense', () => {
    const { daylightHours, sunrise, sunset } = computeSunTimes(noonUtc(2026, 12, 21), 78, UTC);

    expect(daylightHours).toBe(0);
    // Collapsed onto local noon, so nothing counts as daytime.
    expect(sunset).toBe(sunrise);
  });

  it('has a solar noon near the middle of the local day', () => {
    const t = noonUtc(2026, 4, 10);
    const { sunrise, sunset } = computeSunTimes(t, 40, UTC);
    const solarNoonHour = localHours((sunrise + sunset) / 2, UTC);

    expect(solarNoonHour).toBeGreaterThan(11.5);
    expect(solarNoonHour).toBeLessThan(12.5);
  });
});

describe('moonPhase', () => {
  it('stays within the unit interval', () => {
    for (let day = 0; day < 90; day++) {
      const phase = moonPhase(noonUtc(2026, 1, 1) + day * 24 * HOUR);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    }
  });

  it('completes a cycle in about 29.5 days', () => {
    const start = noonUtc(2026, 1, 1);
    const phase = moonPhase(start);
    const later = moonPhase(start + 29.530588853 * 24 * HOUR);

    expect(Math.abs(later - phase)).toBeLessThan(0.01);
  });
});
