// Copied from rag-citations (#2) lib/rag/citations.test.ts unchanged (spec §6: #2's copied tests).
// "spec" below means the rag-citations spec, and R-nn/S-nn are its decisions.
import { describe, expect, it } from "vitest";
import { parseAnswer, parseCodeSpans, type Segment } from "./citations";

const text = (value: string): Segment => ({ type: "text", text: value });
const code = (value: string): Segment => ({ type: "code", text: value });
const cite = (n: number, quote: string): Segment => ({ type: "citation", n, quote });
const malformed = (raw: string): Segment => ({ type: "malformed", raw });

/** Parses a finished answer. */
function parseFinal(answer: string): Segment[] {
  return parseAnswer(answer, { streaming: false });
}

describe("parseAnswer", () => {
  // The grammar: \[(\d{1,2})\s*:\s*["“](.+?)["”]\] (spec §6.2, S-23).
  it.each<[string, string, Segment[]]>([
    [
      "a marker in straight quotes",
      'Use it [1: "embed many values"].',
      [text("Use it "), cite(1, "embed many values"), text(".")],
    ],
    ["a marker in curly quotes", "[1: “embed many values”]", [cite(1, "embed many values")]],
    ["a straight opening and a curly closing quote", '[1: "a b c”]', [cite(1, "a b c")]],
    ["a curly opening and a straight closing quote", '[1: “a b c"]', [cite(1, "a b c")]],
    ["whitespace around the colon", '[2 :  "a b c"]', [cite(2, "a b c")]],
    ["no whitespace", '[2:"a b c"]', [cite(2, "a b c")]],
    ["a line break before the colon", '[2\n: "a b c"]', [cite(2, "a b c")]],
    ["a two-digit number", '[12: "a b c"]', [cite(12, "a b c")]],
    ["a leading zero", '[05: "a b c"]', [cite(5, "a b c")]],
    ["a ] inside the quote", '[1: "see [x] here"]', [cite(1, "see [x] here")]],
    ['a quote that closes at the first "]', '[1: "a "b"] c"]', [cite(1, 'a "b'), text(' c"]')]],
    ["a quote that closes at the first ”]", "[1: “a ”] b”]", [cite(1, "a "), text(" b”]")]],
    ["adjacent markers", '[1: "a b c"][2: "d e f"]', [cite(1, "a b c"), cite(2, "d e f")]],
    [
      "a marker inside backticks, since markers are parsed first",
      '`[1: "a b c"]`',
      [text("`"), cite(1, "a b c"), text("`")],
    ],
  ])("reads %s", (_, answer, segments) => {
    expect(parseFinal(answer)).toEqual(segments);
  });

  // A bracketed number reference outside code spans that is not a marker (spec §6.2, S-12).
  it.each<[string, string, Segment[]]>([
    ["a bare number", "See [2].", [text("See "), malformed("[2]"), text(".")]],
    ["a spaced number", "[ 2 ]", [malformed("[ 2 ]")]],
    ["two numbers", '[1, 3: "a b c"]', [malformed('[1, 3: "a b c"]')]],
    ["a three-digit number", '[123: "a b c"]', [malformed('[123: "a b c"]')]],
    ["single quotes", "[1: 'a b c']", [malformed("[1: 'a b c']")]],
    ["no quotes", "[1: a b c]", [malformed("[1: a b c]")]],
    ["a space before the closing ]", '[1: "a b c" ]', [malformed('[1: "a b c" ]')]],
    ["an empty quote", '[1: ""]', [malformed('[1: ""]')]],
    ["reversed curly quotes", "[1: ”a b c“]", [malformed("[1: ”a b c“]")]],
    ["a quote across a line break", '[1: "a b\nc d"]', [malformed('[1: "a b\nc d"]')]],
    ["two references", "[1] and [2]", [malformed("[1]"), text(" and "), malformed("[2]")]],
  ])("counts %s as malformed", (_, answer, segments) => {
    expect(parseFinal(answer)).toEqual(segments);
  });

  it.each([
    ["a bracket without a number", "Pass [options] here."],
    ["a caret footnote", "A note[^1] here."],
    ["a Markdown link", "See [the docs](/docs/ai-sdk-core)."],
    ["a lone bracket", "Arrays start with [ and end with ]."],
  ])("leaves %s as text", (_, answer) => {
    expect(parseFinal(answer)).toEqual([text(answer)]);
  });

  // Backticks render as <code> only between markers (spec §6.2, R-10).
  it.each<[string, string, Segment[]]>([
    ["a code span", "Call `embedMany` once.", [text("Call "), code("embedMany"), text(" once.")]],
    ["a double-backtick span around a backtick", "``a`b``", [code("a`b")]],
    ["an unmatched backtick", "Type ` then Enter.", [text("Type ` then Enter.")]],
    ["an unclosed run of two backticks", "``a`", [text("``a`")]],
    [
      "a bracketed number inside a code span",
      "Read `items[0]` first.",
      [text("Read "), code("items[0]"), text(" first.")],
    ],
    [
      "a reference between code spans",
      "`a` [2] `b`",
      [code("a"), text(" "), malformed("[2]"), text(" "), code("b")],
    ],
    [
      "code spans between markers",
      'Use `embed` [1: "a b c"] or `embedMany`.',
      [
        text("Use "),
        code("embed"),
        text(" "),
        cite(1, "a b c"),
        text(" or "),
        code("embedMany"),
        text("."),
      ],
    ],
  ])("reads %s", (_, answer, segments) => {
    expect(parseFinal(answer)).toEqual(segments);
  });

  // A suffix that matches the marker-prefix pattern is hidden while streaming and malformed
  // once the stream ends (spec §6.2, R-09, S-12).
  it.each([
    "[",
    "[1",
    "[12",
    "[1 ",
    "[1\n",
    "[1:",
    "[1: ",
    '[1: "',
    "[1: “",
    '[1: "embed many',
    '[1: "embed many"',
    "[1: “embed many”",
    '[1: "a ] b',
  ])("hides the unfinished marker %j while streaming and counts it at the end", (suffix) => {
    expect(parseAnswer(`See ${suffix}`, { streaming: true })).toEqual([text("See ")]);
    expect(parseFinal(`See ${suffix}`)).toEqual([text("See "), malformed(suffix)]);
  });

  it.each(["[123", "[1,", "[a", "[1: x", '[1: "a\nb'])(
    "shows the suffix %j, which cannot become a marker",
    (suffix) => {
      expect(parseAnswer(`See ${suffix}`, { streaming: true })).toEqual([text(`See ${suffix}`)]);
      expect(parseFinal(`See ${suffix}`)).toEqual([text(`See ${suffix}`)]);
    },
  );

  it("hides only the suffix after the last marker", () => {
    const answer = 'A [1: "a b c"], [2] and [3: "d';
    expect(parseAnswer(answer, { streaming: true })).toEqual([
      text("A "),
      cite(1, "a b c"),
      text(", "),
      malformed("[2]"),
      text(" and "),
    ]);
    expect(parseFinal(answer)).toEqual([
      text("A "),
      cite(1, "a b c"),
      text(", "),
      malformed("[2]"),
      text(" and "),
      malformed('[3: "d'),
    ]);
  });

  it("returns no segment for an empty answer or one that is only an unfinished marker", () => {
    expect(parseFinal("")).toEqual([]);
    expect(parseAnswer('[1: "a', { streaming: true })).toEqual([]);
  });

  it("never shows marker text while an answer streams in (R-09)", () => {
    const answer = 'Call `embedMany` [1: "embed many values"], or `embed` [2: “a single value”].';
    for (let end = 0; end <= answer.length; end++) {
      const segments = parseAnswer(answer.slice(0, end), { streaming: true });
      expect(segments.filter((segment) => segment.type === "malformed")).toEqual([]);
      for (const segment of segments) {
        if (segment.type === "text") expect(segment.text).not.toContain("[");
      }
    }
    expect(parseFinal(answer)).toEqual([
      text("Call "),
      code("embedMany"),
      text(" "),
      cite(1, "embed many values"),
      text(", or "),
      code("embed"),
      text(" "),
      cite(2, "a single value"),
      text("."),
    ]);
  });
});

// The same code spans outside answers: the popover and the Sources list show headings such as
// "Generating Text › `streamText`" (R-10).
describe("parseCodeSpans", () => {
  it("splits a heading into text and code spans", () => {
    expect(parseCodeSpans("Generating Text › `streamText` › `onError` callback")).toEqual([
      text("Generating Text › "),
      code("streamText"),
      text(" › "),
      code("onError"),
      text(" callback"),
    ]);
  });

  it("leaves citation markers and bracketed numbers as text", () => {
    expect(parseCodeSpans('See [2] and [1: "a b c"].')).toEqual([
      text('See [2] and [1: "a b c"].'),
    ]);
  });

  it("returns no segment for empty text", () => {
    expect(parseCodeSpans("")).toEqual([]);
  });
});
