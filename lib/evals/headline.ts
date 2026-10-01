import type { EvalsData } from "@/lib/evals/view";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";

/** What the Evals page's headline block says; null lines are not shown. */
export type EvalsHeadline = { headline: string; interval: string | null; passed: string | null };

/**
 * The Evals headline (spec §5): a real run's rate with its 95% CI and passed count. A mock run gets
 * one statement that it measures nothing, with no rate and no interval, so no crop of the page
 * reads as a measurement (ROADMAP Q11; D9, approved 2026-10-01). Pure.
 */
export function evalsHeadline(
  { run, headline }: Pick<EvalsData, "run" | "headline">,
  t: Messages,
): EvalsHeadline {
  const { rate, tickets, passed, level, low, high } = headline;
  if (run.mock) {
    return {
      headline: format(t.evals.mockHeadline, { passed, tickets }),
      interval: null,
      passed: null,
    };
  }
  return {
    headline: format(t.evals.headline, { rate, tickets }),
    interval: format(t.evals.interval, { level, low, high }),
    passed: format(t.evals.passed, { passed, tickets }),
  };
}
