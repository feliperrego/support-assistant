import { isDeepStrictEqual } from "node:util";
import type { EvalRun, TicketResult } from "./record";

/**
 * The mock eval's check in CI (spec §5; ROADMAP S4, "a mock eval in CI"): the mock model's
 * answers are known, so a fresh mock run must give the committed mock run's transcript and verdict
 * for every ticket (measurements/eval-mock.json, the inbox's stand-in). Only the run's date and
 * commit and each ticket's times may differ. A difference means the pipeline or the grader
 * changed: it proves the grader, not the model. Server-only (node:util); pure.
 */

/** A ticket's fields the check compares, each with how a difference is named. */
const COMPARED: readonly [keyof TicketResult, string][] = [
  ["checks", "the checks differ"],
  ["handOffReason", "the hand-off reason differs"],
  ["otherCustomersOrdersAsked", "the other customers' orders asked differ"],
  ["reply", "the reply differs"],
  ["toolCalls", "the tool calls differ"],
  ["citations", "the citations differ"],
];

/** The run as its file holds it: JSON drops undefined fields. */
function asWritten(run: EvalRun): EvalRun {
  return JSON.parse(JSON.stringify(run)) as EvalRun;
}

function verdict(pass: boolean): string {
  return pass ? "pass" : "FAIL";
}

function ticketChanges(before: TicketResult, after: TicketResult): string[] {
  const { id } = before;
  const changes: string[] = [];
  if (before.pass !== after.pass) {
    changes.push(`${id}: ${verdict(before.pass)} → ${verdict(after.pass)}`);
  }
  if (before.actual !== after.actual) {
    changes.push(`${id}: outcome ${before.actual} → ${after.actual}`);
  }
  for (const [field, change] of COMPARED) {
    if (!isDeepStrictEqual(before[field], after[field])) changes.push(`${id}: ${change}`);
  }
  return changes;
}

/** How a fresh mock run differs from the committed one, one line per difference; [] if none. */
export function mockRunChanges(committedRun: EvalRun, freshRun: EvalRun): string[] {
  const committed = asWritten(committedRun);
  const fresh = asWritten(freshRun);
  const changes: string[] = [];
  if (!committed.mock) changes.push("the committed run is not a mock run");
  if (!fresh.mock) changes.push("this run is not a mock run");
  if (committed.ticketSet.sha256 !== fresh.ticketSet.sha256) {
    changes.push("the frozen tickets' SHA-256 differs");
  }
  if (committed.index.corpusHash !== fresh.index.corpusHash) {
    changes.push("the index's corpus hash differs");
  }

  const committedIds = committed.results.map(({ id }) => id);
  const freshIds = fresh.results.map(({ id }) => id);
  if (!isDeepStrictEqual(committedIds, freshIds)) {
    changes.push(`the tickets differ: ${committedIds.join(", ")} → ${freshIds.join(", ")}`);
    return changes;
  }
  return [
    ...changes,
    ...committed.results.flatMap((result, i) => ticketChanges(result, fresh.results[i])),
  ];
}
