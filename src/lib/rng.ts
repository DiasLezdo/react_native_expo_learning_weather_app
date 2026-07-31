/**
 * Deterministic PRNG.
 *
 * Particle layers generate hundreds of positions/delays. If those used
 * `Math.random()` the whole field would reshuffle on every re-render, so every
 * layer derives its field from a seed instead. Same seed -> same sky.
 */

/** mulberry32 — small, fast, good enough distribution for scatter. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof createRng>;

/** Float in [min, max). */
export function range(rng: Rng, min: number, max: number) {
  return min + rng() * (max - min);
}

/** Integer in [min, max]. */
export function intRange(rng: Rng, min: number, max: number) {
  return Math.floor(range(rng, min, max + 1));
}

/** Stable numeric seed from a string, so a city name always yields the same sky. */
export function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
