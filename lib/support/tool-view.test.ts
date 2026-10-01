import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { readShownRun } from "@/lib/inbox/run";
import { stringField, toolViewOfRecord, toolViewsOf } from "./tool-view";

// The live chat and the inbox show a tool call the same way (spec §1 items 2 and 3).
describe("tool views", () => {
  const { run } = readShownRun();

  it("read the same calls from a recorded answer's tool parts as from its transcript", () => {
    for (const result of run.results) {
      const answer = result.messages[1] as UIMessage;
      expect(toolViewsOf(answer), result.id).toEqual(result.toolCalls.map(toolViewOfRecord));
    }
  });

  it("mark a call running until its output arrives, and keep a failed call's error", () => {
    const message = {
      id: "a",
      role: "assistant",
      parts: [
        {
          type: "tool-getOrder",
          toolCallId: "1",
          state: "input-streaming",
          input: { orderId: "AO" },
        },
        {
          type: "tool-getOrder",
          toolCallId: "2",
          state: "output-error",
          input: { orderId: "AO-1" },
          errorText: "boom",
        },
      ],
    } as unknown as UIMessage;
    expect(toolViewsOf(message)).toEqual([
      { id: "1", name: "getOrder", input: { orderId: "AO" }, state: "running" },
      { id: "2", name: "getOrder", input: { orderId: "AO-1" }, error: "boom", state: "error" },
    ]);
  });

  it("read a string field of an input, and nothing else", () => {
    expect(stringField({ orderId: "AO-10351" }, "orderId")).toBe("AO-10351");
    expect(stringField({ orderId: 5 }, "orderId")).toBeUndefined();
    expect(stringField(undefined, "orderId")).toBeUndefined();
  });
});
