/**
 * The statistics of the eval's headline (spec §5), copied from rag-citations (#2)
 * lib/measure/citation-stats.ts: the seeded percentile bootstrap, its generator and quantile, the
 * median and the whole percent. P1 resamples tickets, each a tally of 1 or 0 passes out of 1, so
 * #2's resampling of whole answers applies unchanged. "S-20" is #2's decision on the bootstrap.
 */

/** The seeded bootstrap of the interval (S-20). */
export const BOOTSTRAP = { resamples: 1000, seed: 20260928, level: 0.95 } as const;

export type Interval = { low: number; high: number };

/** Median of the values; the mean of the two middle values when their count is even. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError("median() needs at least one value.");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** mulberry32, a small seeded generator of numbers in [0, 1), so the interval can be re-run. */
export function createRandom(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The p-quantile of sorted values, interpolated between order statistics (numpy's default). */
export function quantile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new RangeError("quantile() needs at least one value.");
  if (!(p >= 0 && p <= 1)) throw new RangeError(`Not a probability: ${p}`);
  const h = (sorted.length - 1) * p;
  const below = Math.floor(h);
  const above = Math.min(below + 1, sorted.length - 1);
  return sorted[below] + (h - below) * (sorted[above] - sorted[below]);
}

/** One answer's citation attempts: how many there were and how many verified. */
export type AnswerTally = { verified: number; total: number };

/**
 * Percentile bootstrap of verified / total, resampling whole answers with replacement, because
 * citations cluster by answer (S-20).
 */
export function bootstrapInterval(
  tallies: readonly AnswerTally[],
  { resamples, seed, level }: { resamples: number; seed: number; level: number },
): Interval {
  if (tallies.length === 0) throw new RangeError("The bootstrap needs at least one answer.");
  if (tallies.some(({ total }) => total < 1)) {
    throw new RangeError("Every answer in the bootstrap needs at least one citation attempt.");
  }
  const random = createRandom(seed);
  const rates: number[] = [];
  for (let i = 0; i < resamples; i++) {
    let verified = 0;
    let total = 0;
    for (let j = 0; j < tallies.length; j++) {
      const tally = tallies[Math.floor(random() * tallies.length)];
      verified += tally.verified;
      total += tally.total;
    }
    rates.push(verified / total);
  }
  rates.sort((a, b) => a - b);
  const tail = (1 - level) / 2;
  return { low: quantile(rates, tail), high: quantile(rates, 1 - tail) };
}

/**
 * A share as a whole percent. A share below 1 never shows 100, and a share above 0 never
 * shows 0, so a rounded headline never claims every or no citation.
 */
export function wholePercent(share: number): number {
  const percent = Math.round(share * 100);
  if (percent === 100 && share < 1) return 99;
  if (percent === 0 && share > 0) return 1;
  return percent;
}
