import type { EvalRun, TicketResult, TokenUsage } from "@/lib/eval/record";
import type { Outcome, TicketKind } from "@/lib/eval/tickets";
import type { ToolCallRecord } from "@/lib/eval/transcript";
import { messageSources } from "@/lib/rag/message";
import { type Customer, type Order } from "@/lib/store/customers";
import { parseStoreDate } from "@/lib/store/dates";
import { type RunLabel, runLabel } from "./run";

/**
 * What the inbox shows of a recorded eval run (spec §1 items 1–3, P-09): one row per conversation
 * with its outcome chip and pass/fail badge, and the right panel's Details and Analysis tabs. The
 * server builds these from the run file and passes them to the client screens. Pure.
 */

/** One row of the conversation list. */
export type ConversationSummary = {
  id: string;
  kind: TicketKind;
  /** The customer's name, or the run's customer id when the store has no such customer. */
  customer: string;
  /** The customer's message, the conversation's only one. */
  message: string;
  expected: Outcome;
  actual: Outcome;
  pass: boolean;
};

export function conversationSummaries(
  results: readonly TicketResult[],
  customers: readonly Customer[],
): ConversationSummary[] {
  const names = new Map(customers.map(({ id, name }) => [id, name]));
  return results.map(({ id, kind, persona, message, expected, actual, pass }) => ({
    id,
    kind,
    customer: names.get(persona) ?? persona,
    message,
    expected,
    actual,
    pass,
  }));
}

/** The Details tab's customer: who wrote, and their orders as the store lists them. */
export type CustomerCard = {
  id: string;
  name: string;
  email: string;
  orders: Pick<Order, "id" | "placedOn" | "status" | "total">[];
};

export function customerCard({ id, name, email, orders }: Customer): CustomerCard {
  return {
    id,
    name,
    email,
    orders: orders
      .map(({ id: orderId, placedOn, status, total }) => ({ id: orderId, placedOn, status, total }))
      .sort((a, b) => parseStoreDate(b.placedOn).getTime() - parseStoreDate(a.placedOn).getTime()),
  };
}

/** One retrieved passage in the Analysis tab, in rank order. */
export type PassageRow = {
  number: number;
  heading: string;
  url: string;
  /** Cosine similarity to the message. */
  score: number;
  /** The answer cites this passage at least once. */
  cited: boolean;
};

/** The Analysis tab of one answer (spec §1, item 3). */
export type AnswerAnalysis = {
  passages: PassageRow[];
  /** The best passage's score and the in-memory search time, from the answer's metadata. */
  retrieval: { topScore: number; searchMs: number } | null;
  toolCalls: ToolCallRecord[];
  usage: TokenUsage | null;
  latencyMs: number | null;
};

export function analysisOf(result: TicketResult): AnswerAnalysis {
  const answer = result.messages.find((message) => message.role === "assistant");
  const cited = new Set(
    result.citations.flatMap((citation) => (citation.type === "citation" ? [citation.n] : [])),
  );
  const passages = (answer === undefined ? [] : messageSources(answer)).map(
    ({ number, heading, url, score }) => ({
      number,
      heading,
      url,
      score,
      cited: cited.has(number),
    }),
  );
  return {
    passages,
    retrieval: answer?.metadata?.retrieval ?? null,
    toolCalls: result.toolCalls,
    usage: result.usage,
    latencyMs: result.latencyMs,
  };
}

/** Everything the inbox page shows: the run, the list and the open conversation. */
export type InboxData = {
  run: RunLabel;
  conversations: ConversationSummary[];
  result: TicketResult;
  customer: CustomerCard | null;
  analysis: AnswerAnalysis;
};

/** The inbox with a conversation open: the run's first by default; null for an unknown id. */
export function inboxData(
  run: EvalRun,
  customers: readonly Customer[],
  ticketId?: string,
): InboxData | null {
  const result =
    ticketId === undefined ? run.results[0] : run.results.find(({ id }) => id === ticketId);
  if (result === undefined) return null;
  const customer = customers.find(({ id }) => id === result.persona);
  return {
    run: runLabel(run),
    conversations: conversationSummaries(run.results, customers),
    result,
    customer: customer === undefined ? null : customerCard(customer),
    analysis: analysisOf(result),
  };
}
