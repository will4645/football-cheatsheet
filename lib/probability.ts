import type { Form } from '@/data/match';

/**
 * Compute P(X >= k) for a Poisson-distributed variable with mean `lambda`.
 * Uses the complement: 1 - P(X <= k-1).
 */
export function poissonAtLeast(lambda: number, k: number): number {
  if (k <= 0) return 1;
  if (lambda <= 0) return 0;

  // P(X <= k-1) = sum_{i=0}^{k-1} e^{-lambda} * lambda^i / i!
  let cumulative = 0;
  let term = Math.exp(-lambda); // i=0 term: e^{-lambda} * lambda^0 / 0!
  for (let i = 0; i < k; i++) {
    cumulative += term;
    term *= lambda / (i + 1);
  }
  return Math.max(0, 1 - cumulative);
}

/**
 * Clamp a probability (0–1) to the nearest 1%, range [1, 100].
 * @param prob Raw probability in range [0, 1]
 * @returns Integer in [1, 100]
 */
export function toScale(prob: number): number {
  return Math.max(1, Math.min(100, Math.round(prob * 100)));
}

/**
 * Returns the scaled probability (as a whole-number percent) that
 * a stat exceeds `threshold`. E.g. overProb(avg, 2.5) = P(X >= 3).
 * @param avg Season average (lambda for Poisson)
 * @param threshold The "over X" value — we compute P(X >= ceil(threshold))
 */
export function overProb(avg: number, threshold: number): number {
  return toScale(poissonAtLeast(avg, Math.ceil(threshold)));
}

/**
 * Determine form badge from last-5-game goal+assist count.
 * >= 3 combined → 'good'
 * 1 or 2        → 'ok'
 * 0             → 'poor'
 */
export function formColor(last5G: number, last5A: number): Form {
  const combined = last5G + last5A;
  if (combined >= 3) return 'good';
  if (combined >= 1) return 'ok';
  return 'poor';
}

/**
 * Generate a deterministic array of 5 booleans representing the last 5 games,
 * where each game has `prob` chance of the stat being hit.
 * Uses a seeded hash so the result is stable for the same player+stat.
 */
export function seededLast5(name: string, stat: string, avgPerGame: number, threshold: number): boolean[] {
  const prob = poissonAtLeast(avgPerGame, threshold);
  const seed = name + stat;
  return Array.from({ length: 5 }, (_, i) => {
    let h = 0;
    for (let j = 0; j < seed.length; j++) h = Math.imul(31, h) + seed.charCodeAt(j) | 0;
    h = Math.imul(h ^ ((i + 1) * 2654435769), 0x9e3779b9) | 0;
    return ((h >>> 0) % 100) / 100 < prob;
  });
}
