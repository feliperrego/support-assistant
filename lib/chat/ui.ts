import { APICallError, type ChatOnFinishCallback, type ChatStatus, type UIMessage } from "ai";

/**
 * Pure helpers of the chat shell (X-01 design §4.2, §4.3). The ones that decide whether a message
 * has something to show take an optional `hasContent` predicate, the same one the message list
 * filters with, and are generic over the message type: under `strict`, a predicate typed on a
 * project's own message type could not be passed where one on UIMessage is expected.
 */

/** The payload useChat passes to `onFinish` (ai 7: message, messages, isAbort, isDisconnect, isError, finishReason). */
export type ChatFinishEvent = Parameters<ChatOnFinishCallback<UIMessage>>[0];

export type FinishAnnotation = {
  /**
   * The finished message's id, or null when that message never reached `messages`: a failed
   * request, or a Stop before the first chunk that adds it. A message that did reach `messages`
   * may still have nothing to show (a step-start part and no text, say): the list hides it and
   * regenerateSlot gives "stopped-row". The chat annotates only non-null ids.
   */
  id: string | null;
  /** The user pressed Stop or Esc. */
  stopped: boolean;
  /** The answer hit the output-token cap (`finishReason === 'length'`). */
  cutOff: boolean;
  /** No abort, no error and no finish reason: a server timeout. */
  interrupted: boolean;
};

export type ChatErrorKind = "limit" | "generic";

export type RegenerateSlot = "after-answer" | "stopped-row" | null;

/** What the screen-reader status line says; each value is a key of the `status` strings. */
export type Announcement = "complete" | "stopped" | "failed";

/** True while a request is in flight. */
export function isBusy(status: ChatStatus): boolean {
  return status === "submitted" || status === "streaming";
}

/** All text parts of a message, joined. Other part types (step-start, reasoning, ...) are ignored. */
export function messageText(message: UIMessage): string {
  let text = "";
  for (const part of message.parts) {
    if (part.type === "text") text += part.text;
  }
  return text;
}

/**
 * True when the message has at least one non-whitespace text character. The default `hasContent`
 * of the chat: a renderer that shows more than text (tool calls, sources) passes its own.
 */
export function hasVisibleText(message: UIMessage): boolean {
  return messageText(message).trim() !== "";
}

/**
 * Turns useChat's `onFinish` payload into the chat's annotations. `message` is never undefined:
 * when nothing was streamed it is a fresh assistant message that is absent from `messages`, and
 * `id` comes back null.
 */
export function annotateFinish({
  message,
  messages,
  isAbort,
  isError,
  finishReason,
}: Pick<
  ChatFinishEvent,
  "message" | "messages" | "isAbort" | "isError" | "finishReason"
>): FinishAnnotation {
  return {
    id: messages.some((m) => m.id === message.id) ? message.id : null,
    stopped: isAbort,
    cutOff: finishReason === "length",
    interrupted: !isAbort && !isError && finishReason == null,
  };
}

/** Enter sends; Shift+Enter inserts a newline; Enter during IME composition does nothing. */
export function shouldSubmitOnKey({
  key,
  shiftKey,
  isComposing,
}: {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
}): boolean {
  return key === "Enter" && !shiftKey && !isComposing;
}

/**
 * Picks the error banner. A non-2xx response makes the default transport throw an
 * `APICallError` whose `statusCode` is the HTTP status; the message text is never inspected.
 */
export function describeChatError(error: unknown): ChatErrorKind {
  return APICallError.isInstance(error) && error.statusCode === 429 ? "limit" : "generic";
}

/**
 * Where the single Regenerate button goes, or null for nowhere.
 * - "after-answer": under the final message, an assistant message with content.
 * - "stopped-row": in the "Stopped before a response" row, only after a user Stop,
 *   when the final message is a user message or an assistant message without content.
 */
export function regenerateSlot<M extends UIMessage>(
  messages: M[],
  status: ChatStatus,
  stoppedByUser: boolean,
  hasContent: (message: M) => boolean = hasVisibleText,
): RegenerateSlot {
  if (isBusy(status)) return null;
  const last = messages.at(-1);
  if (last === undefined) return null;
  if (last.role === "assistant" && hasContent(last)) return "after-answer";
  // The final message is a user message, or an assistant message with no content.
  return stoppedByUser && last.role !== "system" ? "stopped-row" : null;
}

/**
 * Whether the list shows a message as an answer: an assistant message with content. One without
 * (Stop before the first token) is not shown (X-01 design §4.3).
 */
export function showsAssistant<M extends UIMessage>(
  message: M,
  hasContent: (message: M) => boolean = hasVisibleText,
): boolean {
  return message.role === "assistant" && hasContent(message);
}

/** Typing dots: while submitted, or while streaming before the new answer has content. */
export function showTypingIndicator<M extends UIMessage>(
  messages: M[],
  status: ChatStatus,
  hasContent: (message: M) => boolean = hasVisibleText,
): boolean {
  if (status === "submitted") return true;
  if (status !== "streaming") return false;
  const last = messages.at(-1);
  return last === undefined || last.role !== "assistant" || !hasContent(last);
}

/**
 * What the polite status line announces once a request is over; tokens are never read aloud.
 * Nothing while busy. Then "failed" while an error banner shows, "stopped" after a user Stop,
 * "complete" when the final message is an assistant message with content, else null.
 */
export function announcement<M extends UIMessage>(
  {
    messages,
    status,
    failed,
    stoppedByUser,
  }: {
    messages: M[];
    status: ChatStatus;
    /** An error banner shows: a failed request or a server timeout. */
    failed: boolean;
    stoppedByUser: boolean;
  },
  hasContent: (message: M) => boolean = hasVisibleText,
): Announcement | null {
  if (isBusy(status)) return null;
  if (failed) return "failed";
  if (stoppedByUser) return "stopped";
  const last = messages.at(-1);
  return last?.role === "assistant" && hasContent(last) ? "complete" : null;
}
