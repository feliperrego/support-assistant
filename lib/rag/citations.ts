// Copied from rag-citations (#2) lib/rag/citations.ts unchanged (spec §4). "spec" in the comments below
// means the rag-citations spec, and R-nn/S-nn are its decisions.
/** Plain answer text, shown as it is. */
export type TextSegment = { type: "text"; text: string };
/** A code span's content, without its backticks, rendered as <code> (R-10). */
export type CodeSegment = { type: "code"; text: string };
/** A well-formed marker [n: "quote"] (spec §6.2, S-23). */
export type CitationSegment = { type: "citation"; n: number; quote: string };
/** A citation attempt that is not a well-formed marker, as the model wrote it (S-12). */
export type MalformedSegment = { type: "malformed"; raw: string };

/** Each citation attempt counts once in the verified-citation rate (spec §6.3). */
export type CitationAttempt = CitationSegment | MalformedSegment;
export type Segment = TextSegment | CodeSegment | CitationAttempt;

// The marker grammar (spec §6.2, S-23). The lazy quote closes at the first "] or ”], and "."
// stops at a line break, so a quote spans one line.
const MARKER = /\[(\d{1,2})\s*:\s*["“](.+?)["”]\]/g;
// A prefix of a marker, anchored at the end: a suffix that may still become a marker.
const MARKER_PREFIX = /\[(?:\d{1,2}(?:\s*(?::\s*(?:["“].*)?)?)?)?$/;
// CommonMark §6.1: a run of n backticks opens a span that the next run of exactly n closes.
const CODE_SPAN = /(?<!`)(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g;
// A "[" and a number, up to the next "]": [2], [1, 3: "…"] or [1: 'quote'] (S-12).
const NUMBER_REFERENCE = /\[\s*\d[^\]]*\]/g;

/** Plain text, with each bracketed number reference as a malformed attempt. */
function parseProse(text: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of text.matchAll(NUMBER_REFERENCE)) {
    if (match.index > last) segments.push({ type: "text", text: text.slice(last, match.index) });
    segments.push({ type: "malformed", raw: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: "text", text: text.slice(last) });
  return segments;
}

/**
 * Splits text into plain text and code spans, the minimal renderer's only markup (R-10). The
 * answer uses it between markers; the popover and the Sources list use it for headings.
 */
export function parseCodeSpans(text: string): (TextSegment | CodeSegment)[] {
  const segments: (TextSegment | CodeSegment)[] = [];
  let last = 0;
  for (const match of text.matchAll(CODE_SPAN)) {
    if (match.index > last) segments.push({ type: "text", text: text.slice(last, match.index) });
    segments.push({ type: "code", text: match[2] });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: "text", text: text.slice(last) });
  return segments;
}

/** The text between two markers: code spans, and prose outside them (spec §6.2). */
function parseBetweenMarkers(text: string): Segment[] {
  return parseCodeSpans(text).flatMap((segment) =>
    segment.type === "text" ? parseProse(segment.text) : [segment],
  );
}

/**
 * Splits an answer into text, code spans and citation attempts (spec §6.2, R-09). It reads the
 * raw accumulated text, never a single stream chunk, because a marker can be split across
 * chunks. Markers are parsed first; code spans and malformed references only between them.
 * While streaming, a suffix that may still become a marker is hidden; once the stream has
 * ended, it is a malformed attempt, shown as plain text (S-12).
 */
export function parseAnswer(answer: string, { streaming }: { streaming: boolean }): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of answer.matchAll(MARKER)) {
    segments.push(...parseBetweenMarkers(answer.slice(last, match.index)));
    segments.push({ type: "citation", n: Number(match[1]), quote: match[2] });
    last = match.index + match[0].length;
  }

  const tail = answer.slice(last);
  const unfinished = MARKER_PREFIX.exec(tail);
  segments.push(...parseBetweenMarkers(tail.slice(0, unfinished?.index)));
  if (unfinished !== null && !streaming) segments.push({ type: "malformed", raw: unfinished[0] });
  return segments;
}
