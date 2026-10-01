import { PRODUCT_NAME } from "@/lib/project";
import type { EvalRun, EvalSummary, KindTally, TicketResult } from "./record";
import { BOOTSTRAP, bootstrapInterval, median, wholePercent } from "./stats";
import { EXPECTED_OUTCOME, type Outcome, TICKET_MIX, type TicketKind } from "./tickets";

/**
 * The run's summary (spec §5): the headline, "X% of 24 frozen tickets handled correctly (95% CI
 * a–b)", and its supporting data, never a second headline. readmeLines prints README line 1 and
 * the first line of "How it's measured" from it, so no number is typed by hand (template spec
 * §7.5). Pure.
 */

const KINDS = Object.keys(TICKET_MIX) as TicketKind[];
const OUTCOMES = Object.values(EXPECTED_OUTCOME) as Outcome[];

function sum(values: readonly (number | null)[]): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export function summarizeResults(results: readonly TicketResult[]): EvalSummary {
  if (results.length === 0) throw new RangeError("A run needs at least one ticket.");
  const passed = results.filter(({ pass }) => pass).length;
  // One tally per ticket, 1 or 0 passes out of 1: #2's bootstrap resamples whole tickets.
  const tallies = results.map(({ pass }) => ({ verified: pass ? 1 : 0, total: 1 }));

  const byKind = Object.fromEntries(
    KINDS.map((kind): [TicketKind, KindTally] => {
      const ofKind = results.filter((result) => result.kind === kind);
      return [kind, { tickets: ofKind.length, passed: ofKind.filter(({ pass }) => pass).length }];
    }),
  ) as Record<TicketKind, KindTally>;

  const matrix = Object.fromEntries(
    OUTCOMES.map((expected) => [
      expected,
      Object.fromEntries(
        OUTCOMES.map((actual) => [
          actual,
          results.filter((result) => result.expected === expected && result.actual === actual)
            .length,
        ]),
      ),
    ]),
  ) as EvalSummary["matrix"];

  const citations = results.flatMap((result) => result.citations);
  const usages = results.map(({ usage }) => usage);
  const totals = usages.flatMap((usage) => (usage?.totalTokens == null ? [] : [usage.totalTokens]));
  const latencies = results.map(({ latencyMs }) => latencyMs);

  return {
    tickets: results.length,
    passed,
    rate: passed / results.length,
    interval: { ...BOOTSTRAP, ...bootstrapInterval(tallies, BOOTSTRAP) },
    byKind,
    matrix,
    failed: results.filter(({ pass }) => !pass).map(({ id }) => id),
    citations: {
      attempts: citations.length,
      verified: citations.filter(({ status }) => status === "verified").length,
    },
    tokens: {
      input: sum(usages.map((usage) => usage?.inputTokens ?? null)),
      output: sum(usages.map((usage) => usage?.outputTokens ?? null)),
      total: sum(usages.map((usage) => usage?.totalTokens ?? null)),
      medianPerTicket: totals.length === 0 ? null : median(totals),
    },
    latency: { medianMs: median(latencies), maxMs: Math.max(...latencies) },
    otherCustomersOrdersAsked: sum(
      results.map((result) => result.otherCustomersOrdersAsked.length),
    ),
  };
}

export type ReadmeLines = { title: string; howMeasured: string };

/** README line 1 and the first line of "How it's measured", for a run that was not aborted. */
export function readmeLines(run: EvalRun, rawData: string): ReadmeLines {
  const { summary } = run;
  if (run.aborted || summary === null) {
    throw new Error("An aborted run prints no README lines (template spec §7.5).");
  }
  const { interval, byKind } = summary;
  const title =
    `# ${PRODUCT_NAME} — ${wholePercent(summary.rate)}% of ${summary.tickets} frozen tickets ` +
    `handled correctly (${wholePercent(interval.level)}% CI ${wholePercent(interval.low)}–` +
    `${wholePercent(interval.high)}%)`;

  const kinds = KINDS.map((kind) => `${byKind[kind].tickets} ${kind}`).join(", ");
  const handled = KINDS.map(
    (kind) => `${kind} ${byKind[kind].passed} of ${byKind[kind].tickets}`,
  ).join(", ");
  const failed = summary.failed.length === 0 ? "" : ` (failed: ${summary.failed.join(", ")})`;
  const commit = `${run.commit.sha.slice(0, 7)}${run.commit.dirty ? " with local changes" : ""}`;
  const tokens =
    summary.tokens.medianPerTicket === null
      ? ""
      : ` and ${Math.round(summary.tokens.medianPerTicket).toLocaleString("en-US")} tokens`;
  const howMeasured =
    `n=${summary.tickets} frozen English tickets (${kinds}), each asked once to ${run.model} ` +
    "through the chat's own pipeline on the server and scored by script, with no LLM judge, " +
    `on ${run.date.slice(0, 10)} at commit ${commit}; handled correctly: ${handled}${failed}; ` +
    `citations verified: ${summary.citations.verified} of ${summary.citations.attempts}; ` +
    `median ${(summary.latency.medianMs / 1000).toFixed(1)} s${tokens} per ticket. ` +
    `Portuguese is checked by hand, not measured · [raw data](${rawData})`;
  return { title, howMeasured };
}
