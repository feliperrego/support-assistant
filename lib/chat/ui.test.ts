import { APICallError, type ChatStatus, type UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import {
  announcement,
  annotateFinish,
  describeChatError,
  hasVisibleText,
  isBusy,
  messageText,
  regenerateSlot,
  shouldSubmitOnKey,
  showsAssistant,
  showTypingIndicator,
} from "./ui";

function user(id: string, text: string): UIMessage {
  return { id, role: "user", parts: [{ type: "text", text }] };
}

/** Shaped like a streamed assistant message: a step-start part, then text. */
function assistant(id: string, text: string): UIMessage {
  return {
    id,
    role: "assistant",
    parts: [{ type: "step-start" }, { type: "text", text, state: "done" }],
  };
}

/** An assistant step that holds only a tool call: no text, but something a renderer can show. */
function toolOnly(id: string): UIMessage {
  return {
    id,
    role: "assistant",
    parts: [
      { type: "step-start" },
      {
        type: "dynamic-tool",
        toolName: "search",
        toolCallId: "call-1",
        state: "input-available",
        input: { query: "streaming" },
      },
    ],
  };
}

/** A project's content predicate: text, or any tool part (X-01 design §4.3). */
function textOrTool(message: UIMessage): boolean {
  return hasVisibleText(message) || message.parts.some((part) => part.type === "dynamic-tool");
}

function apiCallError(statusCode: number, message = "Server says no."): APICallError {
  return new APICallError({
    message,
    url: "/api/chat",
    requestBodyValues: undefined,
    statusCode,
    responseBody: message,
  });
}

const BUSY: ChatStatus[] = ["submitted", "streaming"];
const IDLE: ChatStatus[] = ["ready", "error"];

describe("messageText / hasVisibleText", () => {
  it("joins only the text parts", () => {
    const message: UIMessage = {
      id: "a",
      role: "assistant",
      parts: [
        { type: "step-start" },
        { type: "text", text: "Hello " },
        { type: "reasoning", text: "hidden" },
        { type: "text", text: "world" },
      ],
    };
    expect(messageText(message)).toBe("Hello world");
  });

  it("treats empty, whitespace-only and text-less messages as not visible", () => {
    expect(hasVisibleText(assistant("a", ""))).toBe(false);
    expect(hasVisibleText(assistant("a", "  \n\t"))).toBe(false);
    expect(hasVisibleText({ id: "a", role: "assistant", parts: [] })).toBe(false);
    expect(hasVisibleText({ id: "a", role: "assistant", parts: [{ type: "step-start" }] })).toBe(
      false,
    );
    expect(hasVisibleText(toolOnly("a"))).toBe(false);
    expect(hasVisibleText(assistant("a", " x "))).toBe(true);
  });
});

describe("isBusy", () => {
  it("is true only while submitted or streaming", () => {
    for (const status of BUSY) expect(isBusy(status)).toBe(true);
    for (const status of IDLE) expect(isBusy(status)).toBe(false);
  });
});

describe("annotateFinish", () => {
  const u = user("u1", "hi");

  it("marks a user Stop as stopped, not interrupted", () => {
    const message = assistant("a1", "partial");
    expect(
      annotateFinish({
        message,
        messages: [u, message],
        isAbort: true,
        isError: false,
        finishReason: undefined,
      }),
    ).toEqual({ id: "a1", stopped: true, cutOff: false, interrupted: false });
  });

  it("marks finishReason 'length' as cut off", () => {
    const message = assistant("a1", "long answer");
    expect(
      annotateFinish({
        message,
        messages: [u, message],
        isAbort: false,
        isError: false,
        finishReason: "length",
      }),
    ).toEqual({ id: "a1", stopped: false, cutOff: true, interrupted: false });
  });

  it("marks no abort, no error and no finishReason as interrupted (timeout)", () => {
    const message = assistant("a1", "partial");
    expect(
      annotateFinish({
        message,
        messages: [u, message],
        isAbort: false,
        isError: false,
        finishReason: undefined,
      }),
    ).toEqual({ id: "a1", stopped: false, cutOff: false, interrupted: true });
  });

  it("is interrupted also when the message never reached messages (empty parts)", () => {
    expect(
      annotateFinish({
        message: { id: "fresh", role: "assistant", parts: [] },
        messages: [u],
        isAbort: false,
        isError: false,
        finishReason: undefined,
      }),
    ).toEqual({ id: null, stopped: false, cutOff: false, interrupted: true });
  });

  it("returns id null for a message absent from messages (nothing but `start` streamed)", () => {
    expect(
      annotateFinish({
        message: { id: "fresh", role: "assistant", parts: [] },
        messages: [u],
        isAbort: true,
        isError: false,
        finishReason: undefined,
      }),
    ).toEqual({ id: null, stopped: true, cutOff: false, interrupted: false });
  });

  it("is neither stopped nor interrupted on an error or a normal finish", () => {
    const message = assistant("a1", "text");
    expect(
      annotateFinish({
        message,
        messages: [u, message],
        isAbort: false,
        isError: true,
        finishReason: undefined,
      }),
    ).toEqual({ id: "a1", stopped: false, cutOff: false, interrupted: false });
    expect(
      annotateFinish({
        message,
        messages: [u, message],
        isAbort: false,
        isError: false,
        finishReason: "stop",
      }),
    ).toEqual({ id: "a1", stopped: false, cutOff: false, interrupted: false });
  });
});

describe("shouldSubmitOnKey", () => {
  it("submits on Enter only", () => {
    expect(shouldSubmitOnKey({ key: "Enter", shiftKey: false, isComposing: false })).toBe(true);
  });

  it("does not submit on Shift+Enter", () => {
    expect(shouldSubmitOnKey({ key: "Enter", shiftKey: true, isComposing: false })).toBe(false);
  });

  it("does not submit while an IME composition is active", () => {
    expect(shouldSubmitOnKey({ key: "Enter", shiftKey: false, isComposing: true })).toBe(false);
  });

  it("does not submit on other keys", () => {
    expect(shouldSubmitOnKey({ key: "a", shiftKey: false, isComposing: false })).toBe(false);
  });
});

describe("describeChatError", () => {
  it("maps an APICallError with status 429 to the limit banner", () => {
    expect(describeChatError(apiCallError(429, "Demo limit reached."))).toBe("limit");
  });

  it("maps everything else to the generic banner", () => {
    expect(describeChatError(new TypeError("Failed to fetch"))).toBe("generic");
    expect(describeChatError(apiCallError(500, "<html>boom</html>"))).toBe("generic");
    expect(describeChatError(apiCallError(400, "Bad request."))).toBe("generic");
    expect(describeChatError(new Error("An error occurred."))).toBe("generic");
    expect(describeChatError(undefined)).toBe("generic");
  });

  it("never branches on message text", () => {
    expect(describeChatError(new Error("429 Too Many Requests"))).toBe("generic");
    expect(describeChatError(apiCallError(500, "429"))).toBe("generic");
  });
});

describe("regenerateSlot", () => {
  const u = user("u1", "hi");

  it("puts Regenerate after a final assistant answer with text", () => {
    expect(regenerateSlot([u, assistant("a1", "text")], "ready", false)).toBe("after-answer");
    expect(regenerateSlot([u, assistant("a1", "text")], "ready", true)).toBe("after-answer");
    expect(regenerateSlot([u, assistant("a1", "partial")], "error", false)).toBe("after-answer");
  });

  it("uses the stopped row when the user stopped before any visible text", () => {
    expect(regenerateSlot([u], "ready", true)).toBe("stopped-row");
    expect(regenerateSlot([u, assistant("a1", "")], "ready", true)).toBe("stopped-row");
    expect(regenerateSlot([u, assistant("a1", "  ")], "ready", true)).toBe("stopped-row");
  });

  it("shows nothing for those cases without a user Stop (timeout, error)", () => {
    expect(regenerateSlot([u], "ready", false)).toBeNull();
    expect(regenerateSlot([u, assistant("a1", "")], "ready", false)).toBeNull();
    expect(regenerateSlot([u, assistant("a1", "  ")], "ready", false)).toBeNull();
    expect(regenerateSlot([u], "error", false)).toBeNull();
  });

  it("shows nothing while busy", () => {
    for (const status of BUSY) {
      expect(regenerateSlot([u], status, true)).toBeNull();
      expect(regenerateSlot([u, assistant("a1", "text")], status, false)).toBeNull();
    }
  });

  it("shows nothing for an empty chat", () => {
    expect(regenerateSlot([], "ready", true)).toBeNull();
  });

  // The list hides what the predicate calls empty, so the slot must follow the same predicate.
  it("reads a final message through hasContent", () => {
    const tool = toolOnly("a1");
    // By default a tool-only step has no visible text: the list hides it.
    expect(regenerateSlot([u, tool], "ready", true)).toBe("stopped-row");
    expect(regenerateSlot([u, tool], "ready", false)).toBeNull();
    // A project whose renderer shows tool parts passes a predicate that counts them.
    expect(regenerateSlot([u, tool], "ready", false, textOrTool)).toBe("after-answer");
    expect(regenerateSlot([u, tool], "ready", true, textOrTool)).toBe("after-answer");
    // And a predicate stricter than the default hides text the default would show.
    const never = () => false;
    expect(regenerateSlot([u, assistant("a1", "text")], "ready", true, never)).toBe("stopped-row");
  });
});

describe("showTypingIndicator", () => {
  const u = user("u1", "hi");

  it("shows while submitted", () => {
    expect(showTypingIndicator([u], "submitted")).toBe(true);
    expect(showTypingIndicator([u, assistant("old", "old answer")], "submitted")).toBe(true);
  });

  it("shows while streaming until the new assistant message has visible text", () => {
    expect(showTypingIndicator([u, assistant("a1", "")], "streaming")).toBe(true);
    expect(showTypingIndicator([u, assistant("a1", " ")], "streaming")).toBe(true);
    expect(showTypingIndicator([u, assistant("a1", "Hi")], "streaming")).toBe(false);
  });

  it("hides when idle", () => {
    for (const status of IDLE) expect(showTypingIndicator([u], status)).toBe(false);
  });

  it("reads the streaming message through hasContent", () => {
    expect(showTypingIndicator([u, toolOnly("a1")], "streaming")).toBe(true);
    expect(showTypingIndicator([u, toolOnly("a1")], "streaming", textOrTool)).toBe(false);
    // Submitted shows the dots whatever the predicate says.
    expect(showTypingIndicator([u, toolOnly("a1")], "submitted", textOrTool)).toBe(true);
  });
});

describe("announcement", () => {
  const u = user("u1", "hi");
  const idle = { status: "ready" as const, failed: false, stoppedByUser: false };

  it("says nothing while a request is in flight, whatever else holds", () => {
    for (const status of BUSY) {
      expect(
        announcement({
          messages: [u, assistant("a1", "text")],
          status,
          failed: true,
          stoppedByUser: true,
        }),
      ).toBeNull();
    }
  });

  it("announces a completed answer", () => {
    expect(announcement({ ...idle, messages: [u, assistant("a1", "text")] })).toBe("complete");
  });

  it("announces a failure before a Stop, and a Stop before a complete answer", () => {
    const answered = [u, assistant("a1", "partial")];
    expect(announcement({ ...idle, messages: answered, failed: true, stoppedByUser: true })).toBe(
      "failed",
    );
    expect(announcement({ ...idle, messages: [u], status: "error", failed: true })).toBe("failed");
    expect(announcement({ ...idle, messages: answered, stoppedByUser: true })).toBe("stopped");
    expect(announcement({ ...idle, messages: [u], stoppedByUser: true })).toBe("stopped");
  });

  it("says nothing for an empty chat or a final message with nothing to show", () => {
    expect(announcement({ ...idle, messages: [] })).toBeNull();
    expect(announcement({ ...idle, messages: [u] })).toBeNull();
    expect(announcement({ ...idle, messages: [u, assistant("a1", " ")] })).toBeNull();
  });

  it("reads the final message through hasContent", () => {
    const messages = [u, toolOnly("a1")];
    expect(announcement({ ...idle, messages })).toBeNull();
    expect(announcement({ ...idle, messages }, textOrTool)).toBe("complete");
  });
});

// A predicate typed on a project's own message type is accepted as it is (X-01 design §4.3):
// typecheck fails here if a helper takes `(message: UIMessage) => boolean` instead.
describe("showsAssistant", () => {
  // The list's filter, the fourth use of the content predicate (X-01 design §4.3).
  it("shows an assistant message with text, and never a user message", () => {
    expect(showsAssistant(assistant("a1", "Hello"))).toBe(true);
    expect(showsAssistant(user("u1", "Hello"))).toBe(false);
  });

  it("hides an assistant message with nothing to show: Stop before the first token", () => {
    expect(showsAssistant(assistant("a1", ""))).toBe(false);
  });

  it("hides a tool-only step by default, and shows it with a project's predicate", () => {
    expect(showsAssistant(toolOnly("a1"))).toBe(false);
    expect(showsAssistant(toolOnly("a1"), textOrTool)).toBe(true);
  });
});

describe("the helpers are generic over the message type", () => {
  type NotedMessage = UIMessage<{ note?: string }>;
  const noted = (message: NotedMessage) => message.metadata?.note !== undefined;
  // No text: only the predicate can tell that this answer has content.
  const answer: NotedMessage = {
    id: "a1",
    role: "assistant",
    parts: [{ type: "step-start" }],
    metadata: { note: "from a tool" },
  };
  const question: NotedMessage = { id: "u1", role: "user", parts: [{ type: "text", text: "hi" }] };

  it("take the project's predicate with the project's messages", () => {
    expect(regenerateSlot([question, answer], "ready", false, noted)).toBe("after-answer");
    expect(showTypingIndicator([question, answer], "streaming", noted)).toBe(false);
    expect(showsAssistant(answer, noted)).toBe(true);
    expect(
      announcement(
        { messages: [question, answer], status: "ready", failed: false, stoppedByUser: false },
        noted,
      ),
    ).toBe("complete");
  });
});
