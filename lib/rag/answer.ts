// Copied from rag-citations (#2) lib/rag/answer.ts unchanged (spec §4). "spec" in the comments below
// means the rag-citations spec, and R-nn/S-nn are its decisions.
import { type CitationAttempt, type CodeSegment, parseAnswer, type TextSegment } from "./citations";
import type { Source } from "./message";
import { type Verification, verifyCitation } from "./verify";

/** A citation attempt with its one result (R-14) and, when [n] names a passage, that passage. */
export type CheckedAttempt = {
  type: "attempt";
  attempt: CitationAttempt;
  verification: Verification;
  /** The data-sources entry n of a well-formed marker; null for an unknown source or malformed. */
  source: Source | null;
};

export type AnswerPart = TextSegment | CodeSegment | CheckedAttempt;

/** A passage in the Sources list, with the results of the quotes that cite it (S-16). */
export type CitedSource = { source: Source; verified: number; total: number };

export type CheckedAnswer = {
  parts: AnswerPart[];
  /** The distinct cited passages, in order of first citation (spec §7). */
  cited: CitedSource[];
};

/** Checks an answer's accumulated text; the same checker serves every chunk of one answer. */
export type AnswerChecker = (text: string, options: { streaming: boolean }) => CheckedAnswer;

/**
 * Parses and verifies an answer against the passages its data-sources part carried (spec §6.2,
 * §6.3). A streamed answer is checked again at every chunk, so each distinct marker is verified
 * only once per checker: the result depends only on n, the quote and the passages.
 */
export function createAnswerChecker(sources: readonly Source[]): AnswerChecker {
  const passages = sources.map((source) => source.text);
  const results = new Map<string, Verification>();

  const verify = (attempt: CitationAttempt): Verification => {
    if (attempt.type === "malformed") return verifyCitation(attempt, passages);
    // n is one or two digits, so the first ":" ends it.
    const key = `${attempt.n}:${attempt.quote}`;
    let result = results.get(key);
    if (result === undefined) {
      result = verifyCitation(attempt, passages);
      results.set(key, result);
    }
    return result;
  };

  return (text, { streaming }) => {
    const parts: AnswerPart[] = [];
    // A Map keeps insertion order: the order of first citation.
    const cited = new Map<number, CitedSource>();
    for (const segment of parseAnswer(text, { streaming })) {
      if (segment.type === "text" || segment.type === "code") {
        parts.push(segment);
        continue;
      }
      const verification = verify(segment);
      // Passage n is sources[n - 1], as verifyCitation reads it; outside 1–5 there is none.
      const source = segment.type === "citation" ? (sources[segment.n - 1] ?? null) : null;
      parts.push({ type: "attempt", attempt: segment, verification, source });
      if (source === null) continue;
      const entry = cited.get(source.number) ?? { source, verified: 0, total: 0 };
      entry.total += 1;
      if (verification.status === "verified") entry.verified += 1;
      cited.set(source.number, entry);
    }
    return { parts, cited: [...cited.values()] };
  };
}
