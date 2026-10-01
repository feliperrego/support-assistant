import { describe, expect, it } from "vitest";
import { readIndexFile } from "@/lib/rag/index-file";
import { toSources } from "@/lib/rag/message";
import { storeData } from "@/lib/store/customers";
import type { SupportUIMessage } from "@/lib/support/message";
import { lookUpOrder } from "@/lib/support/tools";
import { toTranscript } from "./transcript";

// The finished answer as the chat holds it, reduced to what the scorer reads (spec §5).

const CHUNKS = readIndexFile().chunks;
const returns = CHUNKS.find(({ id }) => id === "returns#return-window")!;
const refunds = CHUNKS.find(({ id }) => id === "refunds#when-you-get-your-money-back")!;
const SOURCES = toSources([
  { chunk: returns, score: 0.6 },
  { chunk: refunds, score: 0.5 },
]);
const maya = storeData.customers[0];
const order = maya.orders[0];

function answer(parts: SupportUIMessage["parts"]): SupportUIMessage {
  return {
    id: "a1",
    role: "assistant",
    parts: [{ type: "data-sources", data: SOURCES }, ...parts],
  };
}

describe("toTranscript", () => {
  it("joins the text parts of every step into the reply, a blank line apart", () => {
    const transcript = toTranscript(
      answer([
        { type: "step-start" },
        { type: "text", text: "Let me check.", state: "done" },
        { type: "step-start" },
        { type: "text", text: "It was delivered.", state: "done" },
      ]),
    );
    expect(transcript.reply).toBe("Let me check.\n\nIt was delivered.");
  });

  it("lists each tool call with its input and output, in order", () => {
    const lookup = lookUpOrder(maya.id, order.id);
    const transcript = toTranscript(
      answer([
        { type: "step-start" },
        {
          type: "tool-listMyOrders",
          toolCallId: "c1",
          state: "output-available",
          input: {},
          output: { orders: [] },
        },
        {
          type: "tool-getOrder",
          toolCallId: "c2",
          state: "output-available",
          input: { orderId: order.id },
          output: lookup,
        },
        {
          type: "tool-handOff",
          toolCallId: "c3",
          state: "output-error",
          input: { reason: "refund", summary: "s" },
          errorText: "Invalid input",
        },
      ]),
    );
    expect(transcript.toolCalls).toEqual([
      { toolCallId: "c1", toolName: "listMyOrders", input: {}, output: { orders: [] } },
      { toolCallId: "c2", toolName: "getOrder", input: { orderId: order.id }, output: lookup },
      {
        toolCallId: "c3",
        toolName: "handOff",
        input: { reason: "refund", summary: "s" },
        error: "Invalid input",
      },
    ]);
  });

  it("verifies each citation against the passages of the data-sources part, with its article", () => {
    const quote = returns.text.split("\n").find((line) => line.split(" ").length > 8)!;
    const words = quote.split(" ").slice(0, 6).join(" ");
    const transcript = toTranscript(
      answer([
        {
          type: "text",
          text: `Yes [1: "${words}"], but [2: "a refund in one hour"] and [7: "no such passage here"] [3].`,
          state: "done",
        },
      ]),
    );
    expect(transcript.citations).toEqual([
      { type: "citation", n: 1, quote: words, status: "verified", article: "returns" },
      {
        type: "citation",
        n: 2,
        quote: "a refund in one hour",
        status: "not-found",
        article: "refunds",
      },
      {
        type: "citation",
        n: 7,
        quote: "no such passage here",
        status: "unknown-source",
        article: null,
      },
      { type: "malformed", raw: "[3]", status: "malformed", article: null },
    ]);
  });

  it("finds no citation, tool call or text in an empty answer", () => {
    expect(toTranscript(answer([]))).toEqual({ reply: "", toolCalls: [], citations: [] });
  });
});
