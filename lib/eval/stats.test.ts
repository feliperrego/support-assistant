// Copied from rag-citations (#2) lib/measure/citation-stats.test.ts: the tests of the statistics
// P1 reuses for its interval (spec §5). "spec" below means the rag-citations spec, and S-20 is its
// decision on the bootstrap.
import { describe, expect, it } from "vitest";
import {
  BOOTSTRAP,
  bootstrapInterval,
  createRandom,
  median,
  quantile,
  wholePercent,
} from "./stats";

describe("median", () => {
  it("takes the middle value of an odd count and the mean of the two middle ones otherwise", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("does not reorder its input, and rejects an empty list", () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
    expect(() => median([])).toThrow(RangeError);
  });
});

describe("createRandom", () => {
  it("is mulberry32: seed 1 gives the reference implementation's first values", () => {
    const random = createRandom(1);
    expect([random(), random(), random()]).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522,
    ]);
  });

  it("repeats a sequence for a seed, stays in [0, 1), and differs between seeds", () => {
    const a = createRandom(BOOTSTRAP.seed);
    const b = createRandom(BOOTSTRAP.seed);
    const values = Array.from({ length: 10_000 }, () => a());
    expect(Array.from({ length: 10_000 }, () => b())).toEqual(values);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(createRandom(BOOTSTRAP.seed + 1)()).not.toBe(values[0]);
  });
});

describe("quantile", () => {
  it("interpolates linearly between order statistics, as numpy's default percentile does", () => {
    const sorted = [1, 2, 3, 4];
    expect(quantile(sorted, 0)).toBe(1);
    expect(quantile(sorted, 0.25)).toBe(1.75);
    expect(quantile(sorted, 0.5)).toBe(2.5);
    expect(quantile(sorted, 1)).toBe(4);
  });

  it("rejects an empty list and a probability outside [0, 1]", () => {
    expect(() => quantile([], 0.5)).toThrow(RangeError);
    expect(() => quantile([1], 1.01)).toThrow(RangeError);
    expect(() => quantile([1], -0.01)).toThrow(RangeError);
  });
});

describe("bootstrapInterval (S-20)", () => {
  const options = { resamples: 1000, seed: BOOTSTRAP.seed, level: 0.95 };

  it("resamples whole answers, not citations: 10 of 10 and 0 of 10 give 0 to 1", () => {
    // Over citations, 10 of 20 would give about 0.28 to 0.72. Resampling the two answers gives
    // only the rates 0, 0.5 and 1, each tail holding about a quarter of the resamples.
    const interval = bootstrapInterval(
      [
        { verified: 10, total: 10 },
        { verified: 0, total: 10 },
      ],
      options,
    );
    expect(interval).toEqual({ low: 0, high: 1 });
  });

  it("gives a point interval when every answer has the same rate", () => {
    expect(
      bootstrapInterval(
        [
          { verified: 3, total: 3 },
          { verified: 2, total: 2 },
        ],
        options,
      ),
    ).toEqual({ low: 1, high: 1 });
    expect(bootstrapInterval([{ verified: 0, total: 4 }], options)).toEqual({ low: 0, high: 0 });
  });

  it("is close to the normal approximation of the ratio's error on a larger sample", () => {
    // 40 answers of 1 to 5 citations, about 70% verified, with the rate varying by answer.
    const tallies = Array.from({ length: 40 }, (_, i) => {
      const total = 1 + (i % 5);
      return { verified: Math.min(total, Math.round(total * 0.7 + ((i * 7) % 3) - 1)), total };
    });
    const verified = tallies.reduce((sum, t) => sum + t.verified, 0);
    const total = tallies.reduce((sum, t) => sum + t.total, 0);
    const rate = verified / total;
    // The linearised standard error of a ratio estimator over clusters.
    const n = tallies.length;
    const squares = tallies.reduce((sum, t) => sum + (t.verified - rate * t.total) ** 2, 0);
    const se = Math.sqrt((n / (n - 1)) * squares) / total;

    const { low, high } = bootstrapInterval(tallies, options);

    expect(low).toBeLessThan(rate);
    expect(high).toBeGreaterThan(rate);
    expect(Math.abs(low - (rate - 1.96 * se))).toBeLessThan(0.02);
    expect(Math.abs(high - (rate + 1.96 * se))).toBeLessThan(0.02);
  });

  it("is reproducible: the same seed gives the same interval, and another seed another one", () => {
    const tallies = [
      { verified: 3, total: 4 },
      { verified: 2, total: 2 },
      { verified: 1, total: 3 },
      { verified: 5, total: 5 },
      { verified: 2, total: 3 },
    ];
    const interval = bootstrapInterval(tallies, options);
    expect(bootstrapInterval(tallies, options)).toEqual(interval);
    expect(bootstrapInterval(tallies, { ...options, seed: options.seed + 1 })).not.toEqual(
      interval,
    );
  });

  it("rejects no answers, and an answer without citations", () => {
    expect(() => bootstrapInterval([], options)).toThrow(RangeError);
    expect(() => bootstrapInterval([{ verified: 0, total: 0 }], options)).toThrow(RangeError);
  });
});

describe("wholePercent", () => {
  it("rounds a share to a whole percent", () => {
    expect(wholePercent(0.964)).toBe(96);
    expect(wholePercent(0.965)).toBe(97);
    expect(wholePercent(1)).toBe(100);
    expect(wholePercent(0)).toBe(0);
  });

  it("never rounds a share below 1 up to 100, or a share above 0 down to 0", () => {
    expect(wholePercent(0.996)).toBe(99);
    expect(wholePercent(0.004)).toBe(1);
  });
});
