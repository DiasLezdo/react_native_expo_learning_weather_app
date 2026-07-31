import type { DayPart, WeatherCondition } from '@/weather/types';
import type { SkyPalette } from './types';

/**
 * Palettes are defined per condition for `day` and `night` only.
 *
 * Dawn and dusk are *not* 28 more hand-tuned gradients — they reuse the day
 * palette and are warmed by `HorizonGlow`, a tinted layer composited over the
 * base gradient. One glow handles golden hour for every condition, which keeps
 * the matrix honest and means a new condition only needs two entries.
 */

type PaletteMatrix = Record<WeatherCondition, { day: SkyPalette; night: SkyPalette }>;

const PALETTES: PaletteMatrix = {
  clear: {
    day: {
      colors: ['#0A4EA8', '#1877D4', '#4BA6EC', '#93D2F6'],
      locations: [0, 0.38, 0.72, 1],
      accent: '#FFD66B',
      particle: '#FFFFFF',
      cloud: '#FFFFFF',
      scrim: 0.24,
    },
    night: {
      colors: ['#01030E', '#050A20', '#0B1738', '#14264D'],
      locations: [0, 0.4, 0.74, 1],
      accent: '#8FB8FF',
      particle: '#DCE8FF',
      cloud: '#2A3A5C',
      scrim: 0,
    },
  },
  'partly-cloudy': {
    day: {
      colors: ['#0F5FBE', '#2E8ADB', '#69B6EB', '#AFD9F2'],
      locations: [0, 0.36, 0.7, 1],
      accent: '#FFD27A',
      particle: '#FFFFFF',
      cloud: '#FFFFFF',
      scrim: 0.24,
    },
    night: {
      colors: ['#02051A', '#080F2C', '#101D40', '#1A2B54'],
      accent: '#9CBEFF',
      particle: '#D6E4FF',
      cloud: '#31425F',
      scrim: 0,
    },
  },
  cloudy: {
    day: {
      colors: ['#4E6982', '#71899F', '#93A8BB', '#B6C7D6'],
      accent: '#EAF2F8',
      particle: '#FFFFFF',
      cloud: '#F2F6FA',
      scrim: 0.2,
    },
    night: {
      colors: ['#080D17', '#121926', '#1C2637', '#28344A'],
      accent: '#A8BCD4',
      particle: '#C9D6E6',
      cloud: '#33415A',
      scrim: 0,
    },
  },
  overcast: {
    day: {
      colors: ['#3F4A56', '#5A6672', '#76828E', '#929DA9'],
      accent: '#D5DDE5',
      particle: '#E8EEF4',
      cloud: '#C3CCD6',
      scrim: 0.14,
    },
    night: {
      colors: ['#06080C', '#10141A', '#191F27', '#232A35'],
      accent: '#93A2B4',
      particle: '#B6C2D0',
      cloud: '#2B3340',
      scrim: 0,
    },
  },
  fog: {
    day: {
      colors: ['#8794A0', '#A2AEB8', '#BDC6CE', '#D6DDE2'],
      accent: '#FFFFFF',
      particle: '#FFFFFF',
      cloud: '#EDF1F4',
      scrim: 0.26,
    },
    night: {
      colors: ['#0E1216', '#181E25', '#232B34', '#2F3841'],
      accent: '#9FB0BE',
      particle: '#C6D2DC',
      cloud: '#3C4753',
      scrim: 0,
    },
  },
  haze: {
    day: {
      colors: ['#A8571F', '#CE8038', '#E5A961', '#F3CE97'],
      accent: '#FFE0A3',
      particle: '#FFDCA8',
      cloud: '#F0CDA4',
      scrim: 0.22,
    },
    night: {
      colors: ['#120905', '#20130C', '#2E1E15', '#3E2A1F'],
      accent: '#E0A868',
      particle: '#D9B48A',
      cloud: '#412E22',
      scrim: 0,
    },
  },
  drizzle: {
    day: {
      colors: ['#3C5064', '#53687D', '#6B8096', '#8598AC'],
      accent: '#B8D8EC',
      particle: '#D8ECFA',
      cloud: '#93A6B8',
      scrim: 0.12,
    },
    night: {
      colors: ['#050910', '#0D141F', '#151F2E', '#1F2B3D'],
      accent: '#8FB6D4',
      particle: '#B9D6EC',
      cloud: '#2A374A',
      scrim: 0,
    },
  },
  rain: {
    day: {
      colors: ['#26374A', '#374B60', '#496076', '#5D758C'],
      accent: '#9FD1F0',
      particle: '#CDE8FA',
      cloud: '#7C8FA3',
      scrim: 0.1,
    },
    night: {
      colors: ['#03060C', '#0A111B', '#121C29', '#1B2637'],
      accent: '#7FB4DC',
      particle: '#AFD2EC',
      cloud: '#243141',
      scrim: 0,
    },
  },
  'heavy-rain': {
    day: {
      colors: ['#1A2634', '#273648', '#34475C', '#425870'],
      accent: '#8CC6EC',
      particle: '#C4E2F7',
      cloud: '#66788C',
      scrim: 0.08,
    },
    night: {
      colors: ['#010308', '#070B14', '#0D1520', '#141E2C'],
      accent: '#6FA9D6',
      particle: '#A2C8E6',
      cloud: '#1D2836',
      scrim: 0,
    },
  },
  thunderstorm: {
    day: {
      colors: ['#131822', '#1F2632', '#2B3543', '#384456'],
      accent: '#C6B4FF',
      particle: '#BFDCF2',
      cloud: '#4B586B',
      scrim: 0.06,
    },
    night: {
      colors: ['#000104', '#04060C', '#080D16', '#0E1522'],
      accent: '#B7A2FF',
      particle: '#9EC4E0',
      cloud: '#18202D',
      scrim: 0,
    },
  },
  snow: {
    day: {
      colors: ['#63788F', '#8398AE', '#A7BACD', '#CEDDEA'],
      accent: '#FFFFFF',
      particle: '#FFFFFF',
      cloud: '#E4EDF5',
      scrim: 0.2,
    },
    night: {
      colors: ['#080F1C', '#121C2C', '#1C293C', '#28374E'],
      accent: '#D6E7FA',
      particle: '#FFFFFF',
      cloud: '#33445C',
      scrim: 0,
    },
  },
  sleet: {
    day: {
      colors: ['#3A4B5E', '#516274', '#6A7B8D', '#8695A6'],
      accent: '#D3E6F5',
      particle: '#E6F3FC',
      cloud: '#8D9DAE',
      scrim: 0.12,
    },
    night: {
      colors: ['#05080F', '#0D131D', '#161E2B', '#20293A'],
      accent: '#A9CBE4',
      particle: '#D2E6F5',
      cloud: '#2A3648',
      scrim: 0,
    },
  },
  hail: {
    day: {
      colors: ['#2E3D4E', '#405162', '#546677', '#6B7D8F'],
      accent: '#E3F1FB',
      particle: '#FFFFFF',
      cloud: '#7A8B9C',
      scrim: 0.1,
    },
    night: {
      colors: ['#03060B', '#0A0F18', '#111825', '#1A2333'],
      accent: '#BBDCF0',
      particle: '#E8F4FC',
      cloud: '#22303F',
      scrim: 0,
    },
  },
  wind: {
    day: {
      colors: ['#2F6488', '#4E86A6', '#77AAC4', '#A6CBDD'],
      accent: '#DFF2FB',
      particle: '#FFFFFF',
      cloud: '#E3EFF6',
      scrim: 0.18,
    },
    night: {
      colors: ['#040A11', '#0C151F', '#15212E', '#1F2E3E'],
      accent: '#93C0DA',
      particle: '#C2DCEC',
      cloud: '#2B3B4C',
      scrim: 0,
    },
  },
};

/**
 * Warm wash composited over the base gradient during golden hour. `alpha` is
 * the strength of the overlay; `colors` run top (sky) to bottom (horizon).
 */
export const HORIZON_GLOW: Record<DayPart, { colors: readonly [string, string, string]; alpha: number }> = {
  dawn: { colors: ['#2B1B4A00', '#C05E7A66', '#F0A15CCC'], alpha: 1 },
  day: { colors: ['#00000000', '#00000000', '#00000000'], alpha: 0 },
  dusk: { colors: ['#1B123A00', '#B8455E77', '#F07A3ADD'], alpha: 1 },
  night: { colors: ['#00000000', '#00000000', '#00000000'], alpha: 0 },
};

export function getPalette(condition: WeatherCondition, dayPart: DayPart): SkyPalette {
  const entry = PALETTES[condition] ?? PALETTES.clear;
  return dayPart === 'night' ? entry.night : entry.day;
}

/** Golden hour keeps the day palette but leans warm; night is its own world. */
export function isNightLike(dayPart: DayPart) {
  return dayPart === 'night';
}
