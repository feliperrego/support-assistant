// Copied from rag-citations (#2) lib/rag/answer.test.ts; only ".mdx" file names became ".md".
// "spec" below means the rag-citations spec, and R-nn/S-nn are its decisions.
import { describe, expect, it, vi } from "vitest";
import { type AnswerPart, createAnswerChecker } from "./answer";
import type { CitationAttempt } from "./citations";
import { toSources } from "./message";
import { type Verification, verifyCitation } from "./verify";

// The real verifyCitation, the one function the badge and the measurement share (R-14), with a
// spy that counts its calls.
vi.mock("./verify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./verify")>();
  return { ...actual, verifyCitation: vi.fn(actual.verifyCitation) };
});

const PASSAGES = [
  "## Settings\n\nThe `embedMany` function accepts a maxParallelCalls setting.\n",
  "## Retries\n\nBy default the call is retried twice before it fails.\n",
  "## Testing\n\nUse MockLanguageModelV4 to test without calling a real model.\n",
];
const SOURCES = toSources(
  PASSAGES.map((text, i) => ({
    chunk: {
      id: `c${i + 1}`,
      file: `c${i + 1}.md`,
      heading: `Title › C${i + 1}`,
      startLine: 5,
      endLine: 8,
      text,
    },
    score: 0.5 - i / 10,
  })),
);

const text = (value: string): AnswerPart => ({ type: "text", text: value });
const code = (value: string): AnswerPart => ({ type: "code", text: value });

function attempt(
  segment: CitationAttempt,
  verification: Verification,
  source: number | null,
): AnswerPart {
  return {
    type: "attempt",
    attempt: segment,
    verification,
    source: source === null ? null : SOURCES[source - 1],
  };
}

/** The verified match of `quote` in passage n: its offsets in the original text. */
function verified(quote: string, n: number): Verification {
  const start = PASSAGES[n - 1].indexOf(quote);
  return { status: "verified", start, end: start + quote.length };
}

describe("createAnswerChecker", () => {
  it("keeps text and code, and gives each citation attempt its result and passage", () => {
    const check = createAnswerChecker(SOURCES);
    const answer =
      'Call `embedMany` [1: "accepts a maxParallelCalls setting"], not [1: "accepts a timeout ' +
      'setting"], [9: "a b c"] or [2].';

    expect(check(answer, { streaming: false }).parts).toEqual([
      text("Call "),
      code("embedMany"),
      text(" "),
      attempt(
        { type: "citation", n: 1, quote: "accepts a maxParallelCalls setting" },
        verified("accepts a maxParallelCalls setting", 1),
        1,
      ),
      text(", not "),
      attempt(
        { type: "citation", n: 1, quote: "accepts a timeout setting" },
        { status: "not-found" },
        1,
      ),
      text(", "),
      attempt({ type: "citation", n: 9, quote: "a b c" }, { status: "unknown-source" }, null),
      text(" or "),
      attempt({ type: "malformed", raw: "[2]" }, { status: "malformed" }, null),
      text("."),
    ]);
  });

  it("lists each cited passage once, in order of first citation, with its quotes' results (S-16)", () => {
    const check = createAnswerChecker(SOURCES);
    const answer =
      '[2: "retried twice before it fails"] after [1: "accepts a maxParallelCalls setting"], ' +
      'though [2: "is retried three times"] and [2: "the call is retried"].';

    // Passage 3 was retrieved but never cited, so it is not listed.
    expect(check(answer, { streaming: false }).cited).toEqual([
      { source: SOURCES[1], verified: 2, total: 3 },
      { source: SOURCES[0], verified: 1, total: 1 },
    ]);
  });

  it("lists no passage for an unknown source or a malformed attempt", () => {
    const check = createAnswerChecker(SOURCES);
    expect(check('Also [6: "a passage never sent"] and [2].', { streaming: false }).cited).toEqual(
      [],
    );
  });

  it("hides an unfinished marker while streaming, and counts it as malformed once finished", () => {
    const check = createAnswerChecker(SOURCES);
    const answer = 'See [1: "accepts a max';

    expect(check(answer, { streaming: true })).toEqual({ parts: [text("See ")], cited: [] });
    expect(check(answer, { streaming: false })).toEqual({
      parts: [
        text("See "),
        attempt({ type: "malformed", raw: '[1: "accepts a max' }, { status: "malformed" }, null),
      ],
      cited: [],
    });
  });

  it("verifies each marker once, however often the streamed text is checked", () => {
    const check = createAnswerChecker(SOURCES);
    const answer =
      'A [1: "accepts a maxParallelCalls setting"] and [2: "retried twice before it fails"].';
    vi.mocked(verifyCitation).mockClear();

    for (let end = 1; end <= answer.length; end++) check(answer.slice(0, end), { streaming: true });
    const { parts } = check(answer, { streaming: false });

    expect(verifyCitation).toHaveBeenCalledTimes(2);
    expect(parts.filter((part) => part.type === "attempt")).toHaveLength(2);
  });

  it("returns nothing for an empty answer", () => {
    expect(createAnswerChecker(SOURCES)("", { streaming: true })).toEqual({ parts: [], cited: [] });
  });
});
