// Copied from rag-citations (#2) lib/rag/verify.ts (spec §4), with one change: verifyQuote reads \"
// as " (A-15, P1's one improvement). "spec" in the comments below means the rag-citations spec, and
// R-nn/S-nn are its decisions.
import { countWords } from "./chunk";
import type { CitationAttempt } from "./citations";

/** The result of one citation attempt (spec §6.3, R-11, S-12). */
export type CitationStatus = "verified" | "not-found" | "unknown-source" | "malformed";

/** A verified quote carries its match in the original passage: passage.slice(start, end). */
export type Verification =
  | { status: "verified"; start: number; end: number }
  | { status: Exclude<CitationStatus, "verified"> };

// A quote has 3 to 25 words (R-11), counted as MAX_SECTION_WORDS counts them.
const MIN_QUOTE_WORDS = 3;
const MAX_QUOTE_WORDS = 25;

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** One grapheme through NFKC, straight quotes and dashes, and case folding (S-11). */
function fold(grapheme: string): string {
  return grapheme
    .normalize("NFKC")
    .replace(/[‘-‛]/g, "'")
    .replace(/[“-‟]/g, '"')
    .replace(/\p{Pd}/gu, "-")
    .toLowerCase();
}

/** Normalised text, with the original range [start, end) that each UTF-16 unit came from. */
type Mapped = { text: string; starts: number[]; ends: number[] };

// An inline Markdown link, [text](url) with an optional "title": reduced to its text (A-14).
// Its text can wrap onto the next line, but not across a blank line.
const MARKDOWN_LINK = /\[((?:[^\[\]\n]|\n(?![ \t]*\n))+)\]\([^()\s]*(?:\s+"[^"\n]*")?\)/g;

/** The text with each Markdown link reduced to its text (A-14), as a reader sees it. */
export function withoutMarkdownLinks(text: string): string {
  return text.replace(MARKDOWN_LINK, "$1");
}

/** The text with each Markdown link reduced to its text, and where each kept unit came from. */
function withoutLinks(original: string): { text: string; origin: number[] } {
  let text = "";
  const origin: number[] = [];
  const keep = (from: number, to: number) => {
    text += original.slice(from, to);
    for (let i = from; i < to; i++) origin.push(i);
  };
  let last = 0;
  for (const match of original.matchAll(MARKDOWN_LINK)) {
    keep(last, match.index);
    keep(match.index + 1, match.index + 1 + match[1].length);
    last = match.index + match[0].length;
  }
  keep(last, original.length);
  origin.push(original.length);
  return { text, origin };
}

/**
 * Normalises grapheme by grapheme, so every output character maps back to the original text:
 * links reduce to their text, NFKC can compose or expand characters, and whitespace collapses.
 * A run of whitespace becomes one space, mapped to the whole run; leading and trailing
 * whitespace is dropped. A match that runs to the end of a link's text also takes in the rest
 * of the link, so the <mark> covers the whole link.
 */
function normaliseMapped(original: string): Mapped {
  const { text: plain, origin } = withoutLinks(original);
  const inner = normaliseText(plain);
  const startOf = (start: number) => {
    const first = origin[start];
    // A dropped `[` right before the first kept unit opens a link: the <mark> starts there.
    const dropped = start === 0 ? first > 0 : origin[start - 1] < first - 1;
    return dropped && original[first - 1] === "[" ? first - 1 : first;
  };
  const endOf = (end: number) => {
    const last = origin[end - 1] + 1;
    const next = origin[end];
    // The units between the last kept one and the next are dropped link syntax: `](url)`. At the
    // end of the text, origin's last entry is the text's length, so a closing link counts too.
    return next > last && original[last] === "]" ? next : last;
  };
  return {
    text: inner.text,
    starts: inner.starts.map((start) => startOf(start)),
    ends: inner.ends.map((end) => endOf(end)),
  };
}

/** The grapheme-by-grapheme normalisation of text without links, mapped to that text. */
function normaliseText(original: string): Mapped {
  const mapped: Mapped = { text: "", starts: [], ends: [] };
  const append = (value: string, start: number, end: number) => {
    mapped.text += value;
    for (let i = 0; i < value.length; i++) {
      mapped.starts.push(start);
      mapped.ends.push(end);
    }
  };

  // The whitespace run since the last other character.
  let space: { start: number; end: number } | null = null;
  for (const { segment, index } of graphemeSegmenter.segment(original)) {
    const end = index + segment.length;
    for (const char of fold(segment)) {
      if (/\s/u.test(char)) {
        if (space === null) space = { start: index, end };
        else space.end = end;
        continue;
      }
      if (space !== null && mapped.text !== "") append(" ", space.start, space.end);
      space = null;
      append(char, index, end);
    }
  }
  return mapped;
}

/**
 * The whole normalisation (spec §6.3, S-11, A-14): Markdown links reduced to their text, NFKC,
 * curly quotes and dashes made straight, whitespace collapsed, case-folded. Other Markdown and
 * MDX syntax is left as it is.
 */
export function normalise(text: string): string {
  return normaliseMapped(text).text;
}

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** A match that starts or ends inside a word is not verbatim (S-11 allows no partial words). */
function atWordEdges(text: string, at: number, needle: string): boolean {
  const end = at + needle.length;
  const cutAtStart = WORD_CHAR.test(needle[0]) && at > 0 && WORD_CHAR.test(text[at - 1]);
  const cutAtEnd = WORD_CHAR.test(needle[needle.length - 1]) && WORD_CHAR.test(text[end] ?? "");
  return !cutAtStart && !cutAtEnd;
}

/**
 * Checks that a quote of 3 to 25 words is in its passage, after normalising both (spec §6.3),
 * as whole words. When verified, start and end select the match in the original passage, for
 * the <mark>. P1 adds A-15: the quote's \" reads as ", since models escape the quotes inside a
 * marker (P1 spec §7, R3); no other backslash escape is read.
 */
export function verifyQuote(quote: string, passage: string): Verification {
  const needle = normalise(quote.replaceAll('\\"', '"'));
  const words = countWords(needle);
  // A quote containing "] is not found (spec §6.3); after normalising, that covers ”] too.
  if (words < MIN_QUOTE_WORDS || words > MAX_QUOTE_WORDS || needle.includes('"]')) {
    return { status: "not-found" };
  }
  const { text, starts, ends } = normaliseMapped(passage);
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
    if (atWordEdges(text, at, needle)) {
      return { status: "verified", start: starts[at], end: ends[at + needle.length - 1] };
    }
  }
  return { status: "not-found" };
}

/**
 * The one result for each citation attempt, which draws its badge and sets its
 * data-citation-verified (spec §6.3, R-14). Passage n is passages[n - 1]: the data-sources
 * texts, numbered from 1, so with K = 5 any n outside 1–5 is an unknown source (R-11).
 */
export function verifyCitation(
  attempt: CitationAttempt,
  passages: readonly string[],
): Verification {
  if (attempt.type === "malformed") return { status: "malformed" };
  if (attempt.n < 1 || attempt.n > passages.length) return { status: "unknown-source" };
  return verifyQuote(attempt.quote, passages[attempt.n - 1]);
}
