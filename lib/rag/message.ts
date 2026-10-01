// Adapted from rag-citations (#2) lib/rag/message.ts (P1 spec §4). Changes: a passage carries its
// article id, the gold of a policy ticket (spec §5), and links to its Help Center section
// (spec §1, item 5) instead of GitHub; there is no gate metadata (P-06).
import type { LanguageModelUsage, UIMessage } from "ai";
import type { Chunk } from "./chunk";
import type { SearchResult } from "./vector-store";

/** One retrieved passage, as the data-sources part carries it (#2 spec §5 step 7). */
export type Source = {
  /** The n that [n: "quote"] cites: the passage's rank, from 1. */
  number: number;
  /** The article's id, its file name without ".md" (lib/help-center/articles.ts). */
  article: string;
  file: string;
  heading: string;
  startLine: number;
  endLine: number;
  /** chunk.text, the one passage string the model saw and verifyQuote checks (#2, S-22). */
  text: string;
  /** The passage's section in the Help Center (spec §1, item 5). */
  url: string;
  /** Cosine similarity to the message. */
  score: number;
};

/** The tokens of a model call; a count the provider did not report is left out. */
export type AnswerUsage = { inputTokens?: number; outputTokens?: number; totalTokens?: number };

export type RagDataTypes = { sources: Source[] };

/** A message that may carry a data-sources part. */
export type RagUIMessage = UIMessage<unknown, RagDataTypes>;

/** The article of a chunk: its id up to the section's "#". */
export function articleOf(chunk: Pick<Chunk, "id">): string {
  return chunk.id.split("#")[0];
}

/**
 * The Help Center link of a chunk (spec §1, item 5): the article's page, and for a section its
 * anchor, the slug the chunker gave it.
 */
export function helpCenterUrl(chunk: Pick<Chunk, "id">): string {
  return `/help-center/${chunk.id}`;
}

/** The data-sources entries for the retrieved passages, numbered from 1 in rank order. */
export function toSources(results: readonly SearchResult[]): Source[] {
  return results.map(({ chunk, score }, i) => ({
    number: i + 1,
    article: articleOf(chunk),
    file: chunk.file,
    heading: chunk.heading,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    text: chunk.text,
    url: helpCenterUrl(chunk),
    score,
  }));
}

/** The three totals of a model call's usage, the part the eval records (spec §5). */
export function answerUsage({ inputTokens, outputTokens, totalTokens }: LanguageModelUsage) {
  return { inputTokens, outputTokens, totalTokens } satisfies AnswerUsage;
}

const NO_SOURCES: readonly Source[] = [];

/**
 * The passages the data-sources part carried, or one shared empty list when the message has
 * none (yet), so a component can memoize on it.
 */
export function messageSources<M extends RagUIMessage>(message: M): readonly Source[] {
  for (const part of message.parts) {
    if (part.type === "data-sources") return part.data;
  }
  return NO_SOURCES;
}
