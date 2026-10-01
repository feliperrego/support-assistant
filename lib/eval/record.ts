import type { SupportUIMessage } from "@/lib/support/message";
import type { Check } from "./score";
import type { BOOTSTRAP, Interval } from "./stats";
import type { Outcome, TicketKind } from "./tickets";
import type { CitationRecord, ToolCallRecord } from "./transcript";

/**
 * The eval run's file (spec §5, P-09): measurements/eval-YYYY-MM-DD.json for the real run, with
 * every ticket's transcript, score, tokens and latency, and the summary the README lines come
 * from. A mock run writes MOCK_RUN_PATH instead, which the inbox shows until the real run exists.
 * Types only.
 */

/** The metric name of measurements/<metric>-YYYY-MM-DD.json (lib/measure/record.ts). */
export const EVAL_METRIC = "eval";

/**
 * The mock run: `AI_MOCK=1 pnpm eval` rewrites it and CI's `pnpm eval --check` checks it. Never a
 * measurement.
 */
export const MOCK_RUN_PATH = "measurements/eval-mock.json";

/** The tokens of every model call of one answer; null for a count the provider did not report. */
export type TokenUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

/** One frozen ticket, asked once, with its transcript and score. */
export type TicketResult = {
  id: string;
  kind: TicketKind;
  persona: string;
  /** The ticket's message, the conversation's only user message. */
  message: string;
  /** When the message was sent, ISO 8601 in UTC. */
  askedAt: string;
  expected: Outcome;
  actual: Outcome;
  pass: boolean;
  /** Each condition of the ticket's pass rule (lib/eval/score.ts). */
  checks: Check[];
  handOffReason?: string;
  otherCustomersOrdersAsked: string[];
  /** All the assistant's text, markers included. */
  reply: string;
  toolCalls: ToolCallRecord[];
  citations: CitationRecord[];
  /** The user message and the finished answer, as the chat holds them: the inbox renders these. */
  messages: SupportUIMessage[];
  finishReason: string | null;
  usage: TokenUsage | null;
  /** From sending the message to the end of the answer's stream, in milliseconds. */
  latencyMs: number;
};

export type KindTally = { tickets: number; passed: number };

/** The run's numbers: the headline and its supporting data (spec §5). */
export type EvalSummary = {
  tickets: number;
  passed: number;
  /** passed / tickets: the headline. */
  rate: number;
  /** The seeded percentile bootstrap over tickets (#2's, lib/eval/stats.ts). */
  interval: typeof BOOTSTRAP & Interval;
  byKind: Record<TicketKind, KindTally>;
  /** Expected outcome, then actual outcome: how many tickets (spec §1, item 6). */
  matrix: Record<Outcome, Record<Outcome, number>>;
  /** The ids of the tickets that failed, in the set's order. */
  failed: string[];
  /** Every citation attempt in every reply, and how many verified (#2's rate, spec §4). */
  citations: { attempts: number; verified: number };
  /** Token totals over the run, and the median per ticket; counts not reported are left out. */
  tokens: { input: number; output: number; total: number; medianPerTicket: number | null };
  latency: { medianMs: number; maxMs: number };
  /** getOrder calls that named another customer's order; the server answered them as missing. */
  otherCustomersOrdersAsked: number;
};

export type EvalRun = {
  /** The run's start, ISO 8601 in UTC; it names the file. */
  date: string;
  aborted: boolean;
  /** Why the run stopped early, or null. */
  abortReason: string | null;
  /** True for a run of the mock model: never a measurement. */
  mock: boolean;
  /** The model id (lib/ai/model.ts MODEL_LABEL), "mock" in mock mode. */
  model: string;
  /** The commit the run ran at, and whether the working tree had changes. */
  commit: { sha: string; dirty: boolean };
  ticketSet: { path: string; sha256: string; frozenOn: string; tickets: number };
  index: { path: string; model: string; corpusHash: string; chunks: number };
  results: TicketResult[];
  /** Null for an aborted run, which prints no README lines. */
  summary: EvalSummary | null;
};
