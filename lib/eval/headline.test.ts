import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOCK_RUN_PATH, type EvalRun } from "./record";
import { headlineNumbers, readmeLines } from "./summary";

// The Evals page's headline (spec §1 item 6, §5): the same numbers README line 1 prints, so the
// page and the README never disagree (template spec §7.5; ROADMAP Q11, measured numbers only).

const run = JSON.parse(readFileSync(MOCK_RUN_PATH, "utf8")) as EvalRun;

describe("headlineNumbers", () => {
  it("gives the whole percents and counts of the headline", () => {
    const summary = run.summary!;
    expect(headlineNumbers(summary)).toEqual({
      rate: Math.round(summary.rate * 100),
      low: Math.round(summary.interval.low * 100),
      high: Math.round(summary.interval.high * 100),
      level: 95,
      passed: summary.passed,
      tickets: 24,
    });
  });

  it("keeps a share under 100% from showing as 100% (#2's wholePercent)", () => {
    const summary = {
      ...run.summary!,
      rate: 0.997,
      interval: { ...run.summary!.interval, high: 0.999 },
    };
    expect(headlineNumbers(summary)).toMatchObject({ rate: 99, high: 99 });
  });

  it("is what README line 1 prints", () => {
    const { rate, low, high, level, tickets } = headlineNumbers(run.summary!);
    expect(readmeLines(run, MOCK_RUN_PATH).title).toContain(
      `${rate}% of ${tickets} frozen tickets handled correctly (${level}% CI ${low}–${high}%)`,
    );
  });
});
