import {
  compareToYesterday,
  convertTemperature,
  formatClock,
  formatHour,
  formatTemperature,
  formatWeekday,
  formatWindDirection,
  isSameLocalDay,
  toFahrenheit,
  uvCategory,
} from './format';

/**
 * Time formatting is done with offset arithmetic rather than
 * `Intl.DateTimeFormat({ timeZone })`, because Hermes' ICU coverage varies by
 * platform and build. These tests are what makes that choice safe to keep.
 */

const IST = 330; // +05:30
const NEPAL = 345; // +05:45
const LA = -420; // -07:00
const UTC = 0;

describe('temperature', () => {
  it('converts against the fixed points', () => {
    expect(toFahrenheit(0)).toBe(32);
    expect(toFahrenheit(100)).toBe(212);
    expect(toFahrenheit(-40)).toBe(-40);
  });

  it('leaves celsius untouched', () => {
    expect(convertTemperature(21.5, 'c')).toBe(21.5);
  });

  it('rounds for display', () => {
    expect(formatTemperature(21.4, 'c')).toBe('21°');
    expect(formatTemperature(21.6, 'c')).toBe('22°');
    expect(formatTemperature(0, 'f')).toBe('32°');
  });
});

describe('clock formatting', () => {
  it('renders the place-local time, not the device time', () => {
    // 12:00 UTC is 17:30 in India and 05:00 in Los Angeles.
    const t = Date.UTC(2026, 5, 15, 12);

    expect(formatClock(t, IST, true)).toBe('17:30');
    expect(formatClock(t, LA, true)).toBe('05:00');
  });

  it('handles 45-minute offsets', () => {
    expect(formatClock(Date.UTC(2026, 5, 15, 12), NEPAL, true)).toBe('17:45');
  });

  it('renders 12-hour time with midnight and noon as 12', () => {
    expect(formatClock(Date.UTC(2026, 5, 15, 0), UTC, false)).toBe('12:00 AM');
    expect(formatClock(Date.UTC(2026, 5, 15, 12), UTC, false)).toBe('12:00 PM');
    expect(formatClock(Date.UTC(2026, 5, 15, 13, 5), UTC, false)).toBe('1:05 PM');
  });

  it('formats whole hours', () => {
    expect(formatHour(Date.UTC(2026, 5, 15, 15), UTC, true)).toBe('15:00');
    expect(formatHour(Date.UTC(2026, 5, 15, 15), UTC, false)).toBe('3 PM');
  });
});

describe('isSameLocalDay', () => {
  it('groups by the place’s calendar, not UTC’s', () => {
    // 20:00 UTC is already the next day in India (01:30).
    const evening = Date.UTC(2026, 5, 15, 20);
    const nextMorning = Date.UTC(2026, 5, 16, 3);

    expect(isSameLocalDay(evening, nextMorning, IST)).toBe(true);
    expect(isSameLocalDay(evening, nextMorning, UTC)).toBe(false);
  });

  it('separates genuinely different days', () => {
    expect(isSameLocalDay(Date.UTC(2026, 5, 15, 6), Date.UTC(2026, 5, 16, 6), IST)).toBe(false);
  });
});

describe('formatWeekday', () => {
  it('uses the place-local day', () => {
    // 2026-06-15 is a Monday.
    expect(formatWeekday(Date.UTC(2026, 5, 15, 6), UTC)).toBe('Mon');
    expect(formatWeekday(Date.UTC(2026, 5, 15, 6), UTC, true)).toBe('Monday');
  });
});

describe('formatWindDirection', () => {
  it('maps bearings to compass points', () => {
    expect(formatWindDirection(0)).toBe('N');
    expect(formatWindDirection(90)).toBe('E');
    expect(formatWindDirection(180)).toBe('S');
    expect(formatWindDirection(270)).toBe('W');
    expect(formatWindDirection(45)).toBe('NE');
  });

  it('wraps a full circle back to north', () => {
    expect(formatWindDirection(360)).toBe('N');
    expect(formatWindDirection(359)).toBe('N');
  });
});

describe('compareToYesterday', () => {
  it('describes the direction of change', () => {
    expect(compareToYesterday(20, 16, 'c')).toBe('4° warmer than yesterday');
    expect(compareToYesterday(16, 20, 'c')).toBe('4° cooler than yesterday');
  });

  /*
   * The comparison must agree with the rounded numbers on screen. A 0.6°
   * difference that displays as the same value either side would otherwise
   * claim a change the user cannot see anywhere in the UI.
   */
  it('says "same" when both round to the same displayed degree', () => {
    expect(compareToYesterday(20.2, 19.8, 'c')).toBe('Same as yesterday');
  });

  it('compares in the displayed unit', () => {
    // 2°C apart is ~4°F apart, so Fahrenheit shows a bigger number.
    expect(compareToYesterday(20, 18, 'c')).toBe('2° warmer than yesterday');
    expect(compareToYesterday(20, 18, 'f')).toBe('4° warmer than yesterday');
  });
});

describe('uvCategory', () => {
  it('follows the WHO bands', () => {
    expect(uvCategory(1)).toBe('Low');
    expect(uvCategory(4)).toBe('Moderate');
    expect(uvCategory(7)).toBe('High');
    expect(uvCategory(9)).toBe('Very High');
    expect(uvCategory(12)).toBe('Extreme');
  });
});
