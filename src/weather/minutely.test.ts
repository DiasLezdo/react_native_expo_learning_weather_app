import {
  hasMinutelySignal,
  intensityLabel,
  minutelyHeadline,
  precipitationLabel,
  summariseMinutely,
} from './minutely';
import type { MinutelyForecast } from './types';

/** Build a minute series from intensities, one entry per minute. */
function series(intensities: number[]): MinutelyForecast[] {
  return intensities.map((intensity, index) => ({ time: index * 60_000, intensity }));
}

const dry = (n: number) => Array(n).fill(0) as number[];
const wet = (n: number, rate = 2) => Array(n).fill(rate) as number[];

describe('summariseMinutely', () => {
  it('reports nothing when the hour is dry throughout', () => {
    expect(summariseMinutely(series(dry(60)))).toEqual({ kind: 'none', peak: 0 });
  });

  it('reports continuing rain when it never lets up', () => {
    const summary = summariseMinutely(series(wet(60)));
    expect(summary.kind).toBe('continuing');
    expect(summary.peak).toBe(2);
  });

  it('reports when rain stops, counted in minutes from now', () => {
    const summary = summariseMinutely(series([...wet(12), ...dry(48)]));
    expect(summary).toMatchObject({ kind: 'stopping', minutes: 12 });
  });

  it('reports when rain starts, counted in minutes from now', () => {
    const summary = summariseMinutely(series([...dry(20), ...wet(40)]));
    expect(summary).toMatchObject({ kind: 'starting', minutes: 20 });
  });

  /*
   * The reason the sustain window exists. Real minutely data is noisy, and a
   * single dry minute inside a downpour is not the rain "stopping" — reporting
   * it as such would be technically faithful to the data and useless as advice.
   */
  it('ignores a momentary gap in otherwise steady rain', () => {
    const summary = summariseMinutely(series([...wet(10), 0, ...wet(49)]));
    expect(summary.kind).toBe('continuing');
  });

  it('ignores a momentary spot of rain in an otherwise dry hour', () => {
    const summary = summariseMinutely(series([...dry(10), 3, ...dry(49)]));
    expect(summary.kind).toBe('none');
  });

  it('treats a trace below the threshold as dry', () => {
    const summary = summariseMinutely(series(Array(60).fill(0.05)));
    expect(summary.kind).toBe('none');
  });

  it('reports the heaviest minute as the peak', () => {
    const summary = summariseMinutely(series([1, 9.5, 2, ...wet(57)]));
    expect(summary.peak).toBe(9.5);
  });

  it('survives an empty series', () => {
    expect(summariseMinutely([])).toEqual({ kind: 'none', peak: 0 });
  });
});

describe('minutelyHeadline', () => {
  it('names what is actually falling', () => {
    const stopping = summariseMinutely(series([...wet(12), ...dry(48)]));

    expect(minutelyHeadline(stopping, 'Rain')).toBe('Rain stopping in 12 min');
    expect(minutelyHeadline(stopping, 'Snow')).toBe('Snow stopping in 12 min');
  });

  it('says "now" rather than "in 1 min"', () => {
    const stopping = summariseMinutely(series([2, ...dry(59)]));
    expect(minutelyHeadline(stopping, 'Rain')).toBe('Rain stopping now');
  });

  it('reads naturally when there is nothing to report', () => {
    expect(minutelyHeadline({ kind: 'none', peak: 0 }, 'Rain')).toBe(
      'No rain in the next hour',
    );
  });
});

describe('precipitationLabel', () => {
  it('does not call snow "rain"', () => {
    expect(precipitationLabel('snow')).toBe('Snow');
    expect(precipitationLabel('sleet')).toBe('Sleet');
    expect(precipitationLabel('hail')).toBe('Hail');
    expect(precipitationLabel('drizzle')).toBe('Drizzle');
    expect(precipitationLabel('thunderstorm')).toBe('Rain');
    expect(precipitationLabel('clear')).toBe('Rain');
  });
});

describe('intensityLabel', () => {
  it('escalates with rate', () => {
    expect(intensityLabel(0)).toBe('None');
    expect(intensityLabel(0.5)).toBe('Light');
    expect(intensityLabel(2)).toBe('Moderate');
    expect(intensityLabel(6)).toBe('Heavy');
    expect(intensityLabel(20)).toBe('Torrential');
  });
});

describe('hasMinutelySignal', () => {
  it('is false when there is nothing to show', () => {
    expect(hasMinutelySignal(undefined)).toBe(false);
    expect(hasMinutelySignal([])).toBe(false);
    expect(hasMinutelySignal(series(dry(60)))).toBe(false);
  });

  it('is true as soon as any minute is wet', () => {
    expect(hasMinutelySignal(series([...dry(59), 2]))).toBe(true);
  });
});
