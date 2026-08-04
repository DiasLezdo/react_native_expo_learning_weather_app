import type { MinutelyForecast, WeatherCondition } from './types';

/**
 * Reading the next hour of precipitation.
 *
 * The value of minute-level data is not the numbers — it is the one sentence
 * you can derive from them: *should I wait?* Everything here exists to turn 60
 * intensity readings into that sentence.
 */

/** mm/h below which precipitation isn't worth mentioning. */
const WET_THRESHOLD = 0.1;

/**
 * How long a change must hold before it counts, in minutes.
 *
 * Without this, a single dry minute inside a downpour reads as "stopping in 3
 * minutes" — technically true of the data and useless as advice.
 */
const SUSTAIN_MINUTES = 5;

export type MinutelySummary =
  /** Dry now and staying dry. */
  | { kind: 'none'; peak: number }
  /** Precipitating now, and it does not let up within the hour. */
  | { kind: 'continuing'; peak: number }
  /** Precipitating now, stopping in `minutes`. */
  | { kind: 'stopping'; minutes: number; peak: number }
  /** Dry now, starting in `minutes`. */
  | { kind: 'starting'; minutes: number; peak: number };

function isWet(entry: MinutelyForecast) {
  return entry.intensity >= WET_THRESHOLD;
}

/**
 * First index whose wetness differs from `currentlyWet` and stays that way for
 * `SUSTAIN_MINUTES`, or -1 if the hour never meaningfully changes.
 */
function firstSustainedChange(data: MinutelyForecast[], currentlyWet: boolean) {
  for (let i = 1; i < data.length; i++) {
    if (isWet(data[i]) === currentlyWet) continue;

    const until = Math.min(data.length, i + SUSTAIN_MINUTES);
    let holds = true;
    for (let j = i; j < until; j++) {
      if (isWet(data[j]) === currentlyWet) {
        holds = false;
        break;
      }
    }
    if (holds) return i;
  }
  return -1;
}

export function summariseMinutely(data: MinutelyForecast[]): MinutelySummary {
  if (!data.length) return { kind: 'none', peak: 0 };

  const peak = data.reduce((max, entry) => Math.max(max, entry.intensity), 0);
  const wetNow = isWet(data[0]);
  const change = firstSustainedChange(data, wetNow);

  if (wetNow) {
    return change === -1 ? { kind: 'continuing', peak } : { kind: 'stopping', minutes: change, peak };
  }
  return change === -1 ? { kind: 'none', peak } : { kind: 'starting', minutes: change, peak };
}

/** What is falling, so the headline doesn't call snow "rain". */
export function precipitationLabel(condition: WeatherCondition) {
  switch (condition) {
    case 'snow':
      return 'Snow';
    case 'sleet':
      return 'Sleet';
    case 'hail':
      return 'Hail';
    case 'drizzle':
      return 'Drizzle';
    default:
      return 'Rain';
  }
}

export function minutelyHeadline(summary: MinutelySummary, label: string): string {
  switch (summary.kind) {
    case 'none':
      return `No ${label.toLowerCase()} in the next hour`;
    case 'continuing':
      return `${label} for the next hour`;
    case 'stopping':
      return summary.minutes <= 1
        ? `${label} stopping now`
        : `${label} stopping in ${summary.minutes} min`;
    case 'starting':
      return summary.minutes <= 1
        ? `${label} starting now`
        : `${label} starting in ${summary.minutes} min`;
  }
}

/** Plain description of the heaviest minute in the hour. */
export function intensityLabel(peak: number) {
  if (peak < WET_THRESHOLD) return 'None';
  if (peak < 1) return 'Light';
  if (peak < 4) return 'Moderate';
  if (peak < 10) return 'Heavy';
  return 'Torrential';
}

/**
 * Whether the section is worth showing at all.
 *
 * A flat hour of nothing, on a clear day, is noise — but "no rain in the next
 * hour" is genuinely reassuring while it is actually raining, so that case is
 * kept.
 */
export function hasMinutelySignal(data: MinutelyForecast[] | undefined): boolean {
  if (!data || data.length < 2) return false;
  return data.some(isWet);
}

export { WET_THRESHOLD, SUSTAIN_MINUTES };
