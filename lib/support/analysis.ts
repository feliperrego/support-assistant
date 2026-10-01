import type { TokenUsage } from "@/lib/eval/record";
import { type CitationRecord, type ToolCallRecord, toTranscript } from "@/lib/eval/transcript";
import { messageSources, type Source } from "@/lib/rag/message";
import type { SupportUIMessage } from "./message";

/**
 * The Analysis of one answer (spec §1, item 3: "for each answer: the retrieved passages and
 * scores, the tool calls, tokens and latency"), shown in the inbox's right panel for a recorded
 * eval answer and under each finished live answer in "Try as a customer". Pure and client-safe.
 */

/** One retrieved passage in the Analysis, in rank order. */
export type PassageRow = {
  number: number;
  heading: string;
  url: string;
  /** Cosine similarity to the message. */
  score: number;
  /** The answer cites this passage at least once. */
  cited: boolean;
};

export type AnswerAnalysis = {
  passages: PassageRow[];
  /** The best passage's score and the in-memory search time, from the answer's metadata. */
  retrieval: { topScore: number; searchMs: number } | null;
  toolCalls: ToolCallRecord[];
  usage: TokenUsage | null;
  latencyMs: number | null;
};

/** The passages with the cited flag: a passage is cited when any citation attempt names it. */
export function passageRows(
  sources: readonly Source[],
  citations: readonly CitationRecord[],
): PassageRow[] {
  const cited = new Set(
    citations.flatMap((citation) => (citation.type === "citation" ? [citation.n] : [])),
  );
  return sources.map(({ number, heading, url, score }) => ({
    number,
    heading,
    url,
    score,
    cited: cited.has(number),
  }));
}

/** The answer's tokens as the eval records them: a count the provider did not report is null. */
export function tokenUsageOf(message: SupportUIMessage): TokenUsage | null {
  const usage = message.metadata?.usage;
  if (usage === undefined) return null;
  const { inputTokens = null, outputTokens = null, totalTokens = null } = usage;
  return { inputTokens, outputTokens, totalTokens };
}

/**
 * The Analysis of a live answer, from the message the chat holds: the data-sources part, the
 * citations and tool parts (read as the eval reads them, lib/eval/transcript.ts) and the metadata
 * the finish chunk carried (lib/support/pipeline.ts). What has not arrived yet is null.
 */
export function liveAnalysisOf(message: SupportUIMessage): AnswerAnalysis {
  const { citations, toolCalls } = toTranscript(message);
  return {
    passages: passageRows(messageSources(message), citations),
    retrieval: message.metadata?.retrieval ?? null,
    toolCalls,
    usage: tokenUsageOf(message),
    latencyMs: message.metadata?.latencyMs ?? null,
  };
}

/**
 * True when the answer carries anything to analyse: passages, the retrieval, a tool call, tokens
 * or latency. Every answer of the chat route does; one with none (a test's stubbed stream) shows
 * no Analysis toggle, rather than an empty one.
 */
export function hasAnalysis({ passages, retrieval, toolCalls, usage, latencyMs }: AnswerAnalysis) {
  return (
    passages.length > 0 ||
    retrieval !== null ||
    toolCalls.length > 0 ||
    usage !== null ||
    latencyMs !== null
  );
}
