// Copied from rag-citations (#2) lib/rag/verify.test.ts unchanged (spec §6: #2's copied tests).
// "spec" below means the rag-citations spec, and R-nn/S-nn are its decisions.
import { describe, expect, it } from "vitest";
import type { CitationAttempt } from "./citations";
import { normalise, type Verification, verifyCitation, verifyQuote } from "./verify";

describe("normalise", () => {
  // The whole list (spec §6.3, S-11): NFKC, straight quotes and dashes, whitespace, case.
  it.each([
    ["NFKC folds compatibility characters", "ﬁle ｅｍｂｅｄ", "file embed"],
    ["NFKC composes accents", "cafe\u0301", "caf\u00e9"],
    ["curly single quotes become straight", "‘don’t’", "'don't'"],
    ["curly double quotes become straight", "“quoted” „low‟", '"quoted" "low"'],
    ["dashes (en, em, hyphen, bar) become hyphens", "a\u2013b\u2014c\u2010d\u2015e", "a-b-c-d-e"],
    ["whitespace collapses to one space, trimmed", "  a\t\tb\n\n c  ", "a b c"],
    ["non-breaking spaces are whitespace", "a\u00a0\u00a0b", "a b"],
    ["letters are case-folded", "EmbedMany", "embedmany"],
  ])("%s", (_, input, output) => {
    expect(normalise(input)).toBe(output);
  });

  it("reduces a Markdown link to its text and compares other Markdown and MDX as it is (A-14)", () => {
    const mdx = "**Note:** see [the docs](/docs) and <Note>`embed`</Note>";
    expect(normalise(mdx)).toBe("**note:** see the docs and <note>`embed`</note>");
  });
});

const PASSAGE = [
  "## Settings",
  "",
  "The `embedMany` function accepts a **maxParallelCalls** setting — it limits",
  "the number of parallel requests. Don’t set it to “0”.",
  "The ﬁrst call waits.",
].join("\n");

/** The passage text a verified quote marks, or null when the quote is not verified. */
function mark(quote: string, passage: string): string | null {
  const result = verifyQuote(quote, passage);
  return result.status === "verified" ? passage.slice(result.start, result.end) : null;
}

describe("verifyQuote", () => {
  // The offsets select the matching original text, for the <mark> (spec §6.3).
  it.each([
    [
      "the exact words",
      "accepts a **maxParallelCalls** setting",
      "accepts a **maxParallelCalls** setting",
    ],
    ["another letter case", "THE `EMBEDMANY` FUNCTION", "The `embedMany` function"],
    ["a space for a line break", "it limits the number", "it limits\nthe number"],
    ["a hyphen for a dash", "setting - it limits", "setting — it limits"],
    ["straight quotes for curly ones", 'Don\'t set it to "0"', "Don’t set it to “0”"],
    ["the unfolded form of a ligature", "The first call", "The ﬁrst call"],
    ["surrounding whitespace", "  of parallel requests.\n", "of parallel requests."],
  ])("verifies %s", (_, quote, marked) => {
    expect(mark(quote, PASSAGE)).toBe(marked);
  });

  // A-15 (P1's one improvement, approved 2026-10-02 as R3): models write the quote's inner quotes as
  // \" inside the marker; the run of 2026-10-02 lost t05 to it.
  it('reads \\" in a quote as a quote mark (A-15)', () => {
    const passage =
      'On the sign-in page, choose "Forgot password?" and enter the email address on your account.';
    const quote =
      'On the sign-in page, choose \\"Forgot password?\\" and enter the email address on your account.';
    expect(verifyQuote(quote, passage)).toEqual({
      status: "verified",
      start: 0,
      end: passage.length,
    });
  });

  it('reads no other backslash escape: \\n stays as written (A-15 covers \\" only)', () => {
    expect(verifyQuote("one two\\nthree four", "one two\nthree four").status).toBe("not-found");
  });

  it('still verifies an exact quote of a passage that holds a literal \\" (A-15 adds a reading)', () => {
    const passage = 'In JSON, write \\"Returns\\" with the escapes.';
    expect(verifyQuote('write \\"Returns\\" with the escapes', passage)).toEqual({
      status: "verified",
      start: 9,
      end: 43,
    });
  });

  it("keeps a backslash that does not escape a quote", () => {
    const text = "C:\\Users\\me is the folder";
    expect(verifyQuote(text, text)).toEqual({ status: "verified", start: 0, end: text.length });
  });

  it.each([
    ["the first occurrence", "a b c a b c", "a b c", 0, 5],
    ["text after a surrogate pair", "🚀 Launch the rocket now", "launch the rocket", 3, 20],
    ["text after an expanded ligature", "ﬁle one two three", "one two three", 4, 17],
  ])("gives offsets into the original passage for %s", (_, passage, quote, start, end) => {
    expect(verifyQuote(quote, passage)).toEqual({ status: "verified", start, end });
  });

  it.each([
    ["a quote that is not in the passage", "a quote that is not there"],
    ["Markdown left out", "accepts a maxParallelCalls setting"],
    ["words out of order", "function `embedMany` The"],
    ["two words", "`embedMany` function"],
    ["an empty quote", ""],
  ])("does not verify %s", (_, quote) => {
    expect(verifyQuote(quote, PASSAGE)).toEqual({ status: "not-found" });
  });

  // The model drops link syntax when it quotes (spec §16, production check 2); A-14 allows it.
  const LINKED =
    "The AI SDK provides the [`embedMany`](/docs/reference/ai-sdk-core/embed-many) function for this purpose.";
  it.each([
    ["without the link syntax", "The AI SDK provides the `embedMany` function for this purpose."],
    ["with the link syntax kept", LINKED],
  ])("verifies a quote of a linked passage %s, marking the original text (A-14)", (_, quote) => {
    expect(verifyQuote(quote, LINKED)).toEqual({
      status: "verified",
      start: 0,
      end: LINKED.length,
    });
  });

  it("reduces a link whose text wraps onto the next line (A-14)", () => {
    const passage =
      "See the [OpenAI provider\ndocumentation](/providers/openai#mcp-tool) for details.";
    expect(mark("See the OpenAI provider documentation for details.", passage)).toBe(passage);
    expect(
      mark("See the [OpenAI provider documentation](/providers/openai#mcp-tool) for", passage),
    ).toBe(passage.slice(0, -" details.".length));
  });

  it("marks the whole link when a quote starts or ends at a link's text (A-14)", () => {
    const passage = "Use [`embedMany` for batches](/docs/embed-many) of values.";
    expect(mark("`embedMany` for batches of values", passage)).toBe(
      "[`embedMany` for batches](/docs/embed-many) of values",
    );
    expect(mark("Use `embedMany` for batches", passage)).toBe(
      "Use [`embedMany` for batches](/docs/embed-many)",
    );
  });

  it("marks the whole link when a quote ends at a link that ends the passage (A-14)", () => {
    const passage = "Use the helper from [the docs page](/x)";
    expect(mark("helper from the docs page", passage)).toBe("helper from [the docs page](/x)");
  });

  it("marks the original text, cut link syntax included, when a quote ends or starts inside a link's text (A-14)", () => {
    const passage = "Use [`embedMany` for batches](/docs/embed-many) of values.";
    expect(mark("Use `embedMany` for", passage)).toBe("Use [`embedMany` for");
    expect(mark("for batches of values", passage)).toBe("for batches](/docs/embed-many) of values");
  });

  // A quote cut inside a word is not verbatim: S-11 and A-14 allow only whitespace, quote style,
  // Unicode form, letter case and link syntax.
  it.each([
    ["a quote that starts inside a word", "mbed many values in", "embed many values in one call"],
    ["a quote that ends inside a word", "embed many val", "embed many values in one call"],
  ])("does not verify %s", (_, quote, passage) => {
    expect(verifyQuote(quote, passage)).toEqual({ status: "not-found" });
  });

  it.each([
    ["the passage's edges", "embed many values", "embed many values", 0, 17],
    ["punctuation", "(embed many values).", "embed many values", 1, 18],
    [
      "a later whole-word match",
      "reembed many values; embed many values",
      "embed many values",
      21,
      38,
    ],
  ])("verifies a whole-word quote at %s", (_, passage, quote, start, end) => {
    expect(verifyQuote(quote, passage)).toEqual({ status: "verified", start, end });
  });

  it("accepts 3 to 25 words (R-11)", () => {
    const words = Array.from({ length: 30 }, (_, i) => `w${i}`);
    const passage = words.join(" ");
    const quote = (n: number) => words.slice(0, n).join(" ");
    expect(verifyQuote(quote(2), passage).status).toBe("not-found");
    expect(verifyQuote(quote(3), passage).status).toBe("verified");
    expect(verifyQuote(quote(25), passage).status).toBe("verified");
    expect(verifyQuote(quote(26), passage).status).toBe("not-found");
  });

  it.each([
    ["straight", 'Pass `headers["x"]` to the request.', 'Pass `headers["x"]` to'],
    ["curly", "Pass `headers[“x”]` to the request.", "Pass `headers[“x”]` to"],
  ])('does not verify a quote containing a %s "], even one in the passage', (_, passage, quote) => {
    expect(verifyQuote(quote, passage)).toEqual({ status: "not-found" });
  });
});

describe("verifyCitation", () => {
  const PASSAGES = ["zero one two three", "four five six seven", "a", "b", "c"];
  const cite = (n: number, quote: string): CitationAttempt => ({ type: "citation", n, quote });

  it.each<[string, CitationAttempt, Verification]>([
    [
      "a quote from its passage",
      cite(2, "five six seven"),
      { status: "verified", start: 5, end: 19 },
    ],
    ["a quote from another passage", cite(1, "five six seven"), { status: "not-found" }],
    ["passage 0", cite(0, "one two three"), { status: "unknown-source" }],
    ["a passage after the last", cite(6, "one two three"), { status: "unknown-source" }],
    ["a malformed attempt", { type: "malformed", raw: "[2]" }, { status: "malformed" }],
  ])("checks %s", (_, attempt, verification) => {
    expect(verifyCitation(attempt, PASSAGES)).toEqual(verification);
  });
});
