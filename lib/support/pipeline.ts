import {
  convertToModelMessages,
  createUIMessageStream,
  isStepCount,
  type LanguageModel,
  streamText,
  toUIMessageStream,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { CHUNK_TIMEOUT_MS, FIRST_CHUNK_TIMEOUT_MS } from "@/lib/chat/config";
import { toSafeErrorMessage } from "@/lib/chat/errors";
import { buildInstructions } from "@/lib/chat/instructions";
import { MAX_OUTPUT_TOKENS, MAX_STEPS } from "@/lib/chat/limits";
import type { Locale } from "@/lib/i18n/locale";
import { answerUsage, toSources } from "@/lib/rag/message";
import type { Retriever } from "@/lib/rag/retrieve";
import type { Customer } from "@/lib/store/customers";
import type { SupportUIMessage } from "./message";
import { supportTools, supportToolsContext } from "./tools";

/**
 * One answer of the support assistant (spec §4), shared by the chat route and the eval script, so
 * the eval runs the same pipeline server-side (spec §5, S4). In order:
 * 1. retrieve the top 5 help-center passages for the latest user message (#2's retrieval);
 * 2. send the retrieval as metadata and the passages as a data-sources part, before the answer;
 * 3. stream the model with the instructions, the cleaned text-only history (P-07), the three
 *    tools scoped to the persona through their context, and multi-step calls up to MAX_STEPS;
 * 4. send the tokens of every step with the finish chunk.
 * The messages must already be validated and cleaned (lib/chat/validate.ts).
 */
export type SupportReplyOptions = {
  model: LanguageModel;
  retriever: Retriever;
  messages: UIMessage[];
  customer: Customer;
  locale?: Locale;
  abortSignal?: AbortSignal;
};

/** The text of the last user message: the retrieval query (#2 used the question alone, S-17). */
export function latestUserText(messages: readonly UIMessage[]): string {
  const last = messages.findLast((message) => message.role === "user");
  return (last?.parts ?? []).map((part) => (part.type === "text" ? part.text : "")).join("");
}

export function streamSupportReply({
  model,
  retriever,
  messages,
  customer,
  locale,
  abortSignal,
}: SupportReplyOptions): ReadableStream<UIMessageChunk> {
  return createUIMessageStream<SupportUIMessage>({
    // A failed search ends the stream with the generic error; model errors are handled by
    // toUIMessageStream below. Either way the raw error is logged once, on the server.
    onError: toSafeErrorMessage,
    execute: async ({ writer }) => {
      writer.write({ type: "start" });

      const { results, topScore, searchMs } = await retriever.retrieve(latestUserText(messages), {
        abortSignal,
      });
      const retrieval = { topScore, searchMs };
      writer.write({ type: "message-metadata", messageMetadata: { retrieval } });
      const sources = toSources(results);
      writer.write({ type: "data-sources", data: sources });

      const result = streamText({
        model,
        instructions: buildInstructions({
          locale,
          customer,
          passages: sources.map(({ text }) => text),
        }),
        messages: await convertToModelMessages(messages),
        tools: supportTools,
        toolsContext: supportToolsContext(customer.id),
        stopWhen: isStepCount(MAX_STEPS),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        reasoning: "none",
        abortSignal,
        timeout: { firstChunkMs: FIRST_CHUNK_TIMEOUT_MS, chunkMs: CHUNK_TIMEOUT_MS },
        // Suppresses streamText's own console.error(error) default: the error is already
        // logged once by toSafeErrorMessage in toUIMessageStream's onError below.
        onError: () => {},
      });
      writer.merge(
        toUIMessageStream<typeof supportTools, SupportUIMessage>({
          stream: result.stream,
          tools: supportTools,
          sendStart: false,
          sendReasoning: false,
          onError: toSafeErrorMessage,
          messageMetadata: ({ part }) =>
            part.type === "finish" ? { retrieval, usage: answerUsage(part.totalUsage) } : undefined,
        }),
      );
    },
  });
}
