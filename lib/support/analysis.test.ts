import { describe, expect, it } from "vitest";
import { analysisOf } from "@/lib/inbox/view";
import { readShownRun } from "@/lib/inbox/run";
import type { Source } from "@/lib/rag/message";
import { hasAnalysis, liveAnalysisOf } from "./analysis";
import type { SupportUIMessage } from "./message";

// The Analysis of a live answer (spec §1, item 3: "for each answer: the retrieved passages and
// scores, the tool calls, tokens and latency"), built from the message the chat holds.

function source(number: number, text: string, score: number): Source {
  return {
    number,
    article: "returns",
    file: "returns.md",
    heading: `Returns › Section ${number}`,
    startLine: 1,
    endLine: 2,
    text,
    url: `/help-center/returns#section-${number}`,
    score,
  };
}

const sources = [
  source(1, "Items must be unused and with the tags still attached.", 0.61),
  source(2, "You pay for return shipping, unless the item is defective.", 0.42),
];

const answer: SupportUIMessage = {
  id: "a1",
  role: "assistant",
  metadata: {
    retrieval: { topScore: 0.61, searchMs: 1.25 },
    usage: { inputTokens: 1200, outputTokens: 80 },
    latencyMs: 1834,
  },
  parts: [
    { type: "data-sources", data: sources },
    {
      type: "tool-getOrder",
      toolCallId: "c1",
      state: "output-available",
      input: { orderId: "AO-10351" },
      output: { found: false, orderId: "AO-10351", message: "No such order." },
    },
    {
      type: "tool-handOff",
      toolCallId: "c2",
      state: "output-error",
      input: { reason: "refund", summary: "" },
      errorText: "Invalid input for tool handOff",
    },
    { type: "text", text: 'It must be unused [1: "Items must be unused and with the tags"].' },
  ],
};

describe("liveAnalysisOf", () => {
  it("gives the passages with their scores and cited flags, the tool calls, tokens and latency", () => {
    expect(liveAnalysisOf(answer)).toEqual({
      passages: [
        {
          number: 1,
          heading: "Returns › Section 1",
          url: "/help-center/returns#section-1",
          score: 0.61,
          cited: true,
        },
        {
          number: 2,
          heading: "Returns › Section 2",
          url: "/help-center/returns#section-2",
          score: 0.42,
          cited: false,
        },
      ],
      retrieval: { topScore: 0.61, searchMs: 1.25 },
      toolCalls: [
        {
          toolCallId: "c1",
          toolName: "getOrder",
          input: { orderId: "AO-10351" },
          output: { found: false, orderId: "AO-10351", message: "No such order." },
        },
        {
          toolCallId: "c2",
          toolName: "handOff",
          input: { reason: "refund", summary: "" },
          error: "Invalid input for tool handOff",
        },
      ],
      usage: { inputTokens: 1200, outputTokens: 80, totalTokens: null },
      latencyMs: 1834,
    });
  });

  it("leaves out what the message does not carry yet", () => {
    const early: SupportUIMessage = { id: "a2", role: "assistant", parts: [] };
    expect(liveAnalysisOf(early)).toEqual({
      passages: [],
      retrieval: null,
      toolCalls: [],
      usage: null,
      latencyMs: null,
    });
  });

  // An answer with nothing to analyse (no passages, tools or metadata) shows no Analysis toggle.
  it("says whether there is anything to show", () => {
    expect(hasAnalysis(liveAnalysisOf(answer))).toBe(true);
    expect(hasAnalysis(liveAnalysisOf({ id: "a3", role: "assistant", parts: [] }))).toBe(false);
    const textOnly: SupportUIMessage = {
      id: "a4",
      role: "assistant",
      parts: [{ type: "text", text: "ok" }],
    };
    expect(hasAnalysis(liveAnalysisOf(textOnly))).toBe(false);
    const withUsage: SupportUIMessage = {
      ...textOnly,
      metadata: { retrieval: { topScore: 0.2, searchMs: 1 } },
    };
    expect(hasAnalysis(liveAnalysisOf(withUsage))).toBe(true);
  });

  // The inbox and the live chat show one Analysis: same passages and tool calls for one answer.
  it("matches the inbox's Analysis on every recorded answer of the shown run", () => {
    for (const result of readShownRun().run.results) {
      const recorded = result.messages.find((message) => message.role === "assistant");
      if (recorded === undefined) throw new Error(`${result.id} has no answer`);
      const live = liveAnalysisOf(recorded);
      const inbox = analysisOf(result);
      expect(live.passages).toEqual(inbox.passages);
      expect(live.toolCalls).toEqual(inbox.toolCalls);
      expect(live.retrieval).toEqual(inbox.retrieval);
      expect(live.usage).toEqual(inbox.usage);
    }
  });
});
