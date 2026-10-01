import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import {
  ERROR_CHUNKS,
  MOCK_ERROR_MESSAGE,
  MOCK_SCENARIO_TIMING,
  SLOW_CHUNKS,
  mockStep,
  type MockStep,
  type MockTiming,
} from "./mock-scenarios";

type MockStreamResult = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>;

/** One part of a V4 model stream (text-start, text-delta, text-end, tool-call, finish, error, ...). */
export type MockStreamPart =
  MockStreamResult["stream"] extends ReadableStream<infer T> ? T : never;

export type MockModelOptions = {
  initialDelayInMs?: number;
  chunkDelayInMs?: number;
  chunks?: string[];
};

export const DEFAULT_MOCK_TEXT =
  "Streaming lets an answer appear while it is still being written. " +
  "Instead of waiting for the whole response, the interface shows each word " +
  "as soon as the model produces it. That makes a slow answer feel fast, and " +
  "it gives the reader a chance to stop early when the answer is already good " +
  "enough, or clearly going in the wrong direction. This paragraph comes from " +
  "the mock model in the portfolio template. It is split into one chunk per " +
  "word, with a short delay before the first chunk and a small gap between the " +
  "rest, so tests and demos can exercise streaming, stopping, and time to " +
  "first token without calling a real model or spending any money. Nothing " +
  "here was generated; it is the same text every time, which keeps every test " +
  "run predictable.";

/** Splits text into one word plus its trailing whitespace per chunk. */
export function toWordChunks(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [];
}

function finishPart(reason: "stop" | "tool-calls", outputTokens: number): MockStreamPart {
  return {
    type: "finish",
    finishReason: { unified: reason, raw: undefined },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: outputTokens, text: outputTokens, reasoning: undefined },
    },
  };
}

export function buildStreamParts(chunks: readonly string[]): MockStreamPart[] {
  const id = "text-1";
  return [
    { type: "text-start", id },
    ...chunks.map((delta): MockStreamPart => ({ type: "text-delta", id, delta })),
    { type: "text-end", id },
    finishPart("stop", chunks.length),
  ];
}

/**
 * One tool call and the finish of its step (spec §4: tool calling with multi-step calls).
 * streamText runs the tool and calls the model again with its result.
 */
export function buildToolCallParts(
  toolCallId: string,
  toolName: string,
  input: Record<string, unknown>,
): MockStreamPart[] {
  return [
    { type: "tool-call", toolCallId, toolName, input: JSON.stringify(input) },
    finishPart("tool-calls", 1),
  ];
}

/**
 * Text deltas followed by a V4 `error` stream part. streamText turns that part
 * into a UI `error` chunk (errorText from the route's onError). A stream that
 * throws instead (controller.error) would abort the HTTP body with no `error`
 * chunk, so the mock uses the stream part.
 */
export function buildErrorStreamParts(chunks: readonly string[]): MockStreamPart[] {
  const id = "text-1";
  return [
    { type: "text-start", id },
    ...chunks.map((delta): MockStreamPart => ({ type: "text-delta", id, delta })),
    { type: "error", error: new Error(MOCK_ERROR_MESSAGE) },
  ];
}

/** The stream of one mock step: words, a tool call, the slow lines or the failure. */
export function stepStreamParts(step: MockStep): MockStreamPart[] {
  switch (step.kind) {
    case "slow":
      return buildStreamParts(SLOW_CHUNKS);
    case "error":
      return buildErrorStreamParts(ERROR_CHUNKS);
    case "tool-call":
      return buildToolCallParts(step.toolCallId, step.toolName, step.input);
    case "text":
      return buildStreamParts(toWordChunks(step.text));
  }
}

/**
 * The mock that getModel() returns in mock mode (template spec §5.2; spec §4): every doStream call
 * takes its next step from the prompt (lib/ai/mock-scenarios.ts mockStep). Tests and the mock eval
 * may pass a faster timing; the steps stay the same.
 */
export function createScenarioMockModel(
  timing: MockTiming = MOCK_SCENARIO_TIMING,
): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: async ({ prompt }) => ({
      stream: simulateReadableStream({
        chunks: stepStreamParts(mockStep(prompt)),
        initialDelayInMs: timing.initialDelayInMs,
        chunkDelayInMs: timing.chunkDelayInMs,
      }),
    }),
  });
}

/**
 * A deterministic model for CI, local runs without a key, and tests. Without options (how
 * lib/ai/model.ts calls it) it picks a scenario per request from the prompt, so getModel() never
 * takes arguments (template spec §5.2). With options, every call streams the same fixed chunks.
 */
export function createMockModel(options?: MockModelOptions): MockLanguageModelV4 {
  if (options === undefined) return createScenarioMockModel();

  const {
    initialDelayInMs = 600,
    chunkDelayInMs = 30,
    chunks = toWordChunks(DEFAULT_MOCK_TEXT),
  } = options;

  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: buildStreamParts(chunks),
        initialDelayInMs,
        chunkDelayInMs,
      }),
    }),
  });
}
