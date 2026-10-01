import type { EvalRun, EvalSummary } from "@/lib/eval/record";
import { type HeadlineNumbers, headlineNumbers } from "@/lib/eval/summary";
import { EXPECTED_OUTCOME, type Outcome, type TicketKind } from "@/lib/eval/tickets";
import { type RunLabel, runLabel } from "@/lib/inbox/run";
import { type ConversationSummary, conversationSummaries } from "@/lib/inbox/view";
import type { Customer } from "@/lib/store/customers";

/**
 * What the Evals page shows (spec §1 item 6, §5): the headline with its 95% CI, the supporting
 * data and the expected × actual outcome matrix from the run's summary, one row per ticket, and
 * the run's metadata. Every number comes from the run file (ROADMAP Q11). Pure.
 */

/** One row of the per-ticket table; it links to the ticket's transcript in the inbox. */
export type TicketRow = ConversationSummary & { latencyMs: number; totalTokens: number | null };

export type EvalsData = {
  run: RunLabel;
  /** The run's file, repo-relative: the raw data link. */
  file: string;
  summary: EvalSummary;
  headline: HeadlineNumbers;
  tickets: TicketRow[];
  ticketSet: EvalRun["ticketSet"];
  index: EvalRun["index"];
  /**
   * The groups of spec §5 and the four outcomes, in order. lib/eval/tickets.ts reads files, so
   * the client page gets them as data.
   */
  kinds: TicketKind[];
  outcomes: Outcome[];
};

export function evalsData(run: EvalRun, file: string, customers: readonly Customer[]): EvalsData {
  const { summary } = run;
  if (summary === null)
    throw new Error(`${file} has no summary: the Evals page shows finished runs.`);
  const summaries = conversationSummaries(run.results, customers);
  return {
    run: runLabel(run),
    file,
    summary,
    headline: headlineNumbers(summary),
    tickets: summaries.map((row, i) => ({
      ...row,
      latencyMs: run.results[i].latencyMs,
      totalTokens: run.results[i].usage?.totalTokens ?? null,
    })),
    ticketSet: run.ticketSet,
    index: run.index,
    kinds: Object.keys(EXPECTED_OUTCOME) as TicketKind[],
    outcomes: Object.values(EXPECTED_OUTCOME) as Outcome[],
  };
}
