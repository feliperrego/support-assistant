// Adapted from rag-citations (#2) lib/rag/message.test.ts: a passage links to its Help Center
// section (spec §1, item 5) and carries its article id (spec §5).
import { describe, expect, it } from "vitest";
import type { Chunk } from "./chunk";
import { answerUsage, messageSources, type RagUIMessage, toSources } from "./message";

function chunk(id: string, startLine: number, endLine: number): Chunk {
  return {
    id,
    file: `${id.split("#")[0]}.md`,
    heading: `Title › ${id}`,
    startLine,
    endLine,
    text: `## ${id}\n\nText of ${id}.\n`,
  };
}

describe("toSources", () => {
  it("numbers the passages from 1 in rank order, with article, text, lines, Help Center link and score", () => {
    const results = [
      { chunk: chunk("returns#return-window", 12, 40), score: 0.61 },
      { chunk: chunk("refunds", 5, 9), score: 0.42 },
    ];
    expect(toSources(results)).toEqual([
      {
        number: 1,
        article: "returns",
        file: "returns.md",
        heading: "Title › returns#return-window",
        startLine: 12,
        endLine: 40,
        text: "## returns#return-window\n\nText of returns#return-window.\n",
        url: "/help-center/returns#return-window",
        score: 0.61,
      },
      {
        number: 2,
        article: "refunds",
        file: "refunds.md",
        heading: "Title › refunds",
        startLine: 5,
        endLine: 9,
        text: "## refunds\n\nText of refunds.\n",
        url: "/help-center/refunds",
        score: 0.42,
      },
    ]);
  });

  it("returns no sources for no results", () => {
    expect(toSources([])).toEqual([]);
  });
});

describe("messageSources", () => {
  const sources = toSources([{ chunk: chunk("returns#return-window", 12, 40), score: 0.61 }]);

  it("returns the passages of the data-sources part", () => {
    const message: RagUIMessage = {
      id: "a1",
      role: "assistant",
      parts: [
        { type: "data-sources", data: sources },
        { type: "text", text: "An answer." },
      ],
    };
    expect(messageSources(message)).toBe(sources);
  });

  // The same array every time, so a component can memoize on it.
  it("returns one shared empty list for a message without passages", () => {
    const refusal: RagUIMessage = {
      id: "a1",
      role: "assistant",
      parts: [{ type: "text", text: "I don't know." }],
    };
    expect(messageSources(refusal)).toEqual([]);
    expect(messageSources(refusal)).toBe(messageSources({ ...refusal, id: "a2" }));
  });
});

describe("answerUsage", () => {
  it("keeps the three totals and drops the details and the provider's raw usage", () => {
    expect(
      answerUsage({
        inputTokens: 2300,
        inputTokenDetails: { noCacheTokens: 2300, cacheReadTokens: 0, cacheWriteTokens: 0 },
        outputTokens: 180,
        outputTokenDetails: { textTokens: 180, reasoningTokens: 0 },
        totalTokens: 2480,
        raw: { prompt_tokens: 2300 },
      }),
    ).toEqual({ inputTokens: 2300, outputTokens: 180, totalTokens: 2480 });
  });

  it("leaves a count the provider did not report out of the JSON", () => {
    const usage = answerUsage({
      inputTokens: undefined,
      inputTokenDetails: {
        noCacheTokens: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
      },
      outputTokens: 12,
      outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
      totalTokens: undefined,
    });
    expect(JSON.parse(JSON.stringify(usage))).toEqual({ outputTokens: 12 });
  });
});
