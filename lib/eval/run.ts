import { type LanguageModel, readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai";
import { validateAndClean } from "@/lib/chat/validate";
import type { Retriever } from "@/lib/rag/retrieve";
import { type Customer, storeData } from "@/lib/store/customers";
import type { SupportUIMessage } from "@/lib/support/message";
import { streamSupportReply } from "@/lib/support/pipeline";
import type { TicketResult, TokenUsage } from "./record";
import { scoreTicket } from "./score";
import type { Ticket } from "./tickets";
import { toTranscript } from "./transcript";

/**
 * Runs the frozen tickets through the chat's own pipeline on the server, with no browser and no
 * HTTP (spec §5, S4): each ticket is one conversation of one user message, held as its persona,
 * validated as the route validates it, answered by lib/support/pipeline.ts and scored by
 * lib/eval/score.ts. The interface language is English, as the tickets are (spec §5).
 */

export type RunOptions = {
  model: LanguageModel;
  retriever: Retriever;
  customers?: readonly Customer[];
};

/** A ticket's result, or why the run must stop (an error, an abort, a stream with no finish). */
export type TicketOutcome = { result: TicketResult } | { abortReason: string };

/** Every chunk of the answer's stream, in order. */
async function collect(stream: ReadableStream<UIMessageChunk>): Promise<UIMessageChunk[]> {
  const chunks: UIMessageChunk[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return chunks;
    chunks.push(value);
  }
}

/** The finished message, reduced from the chunks by the SDK's own reader, as the chat reduces it. */
async function finishedMessage(chunks: readonly UIMessageChunk[]): Promise<SupportUIMessage> {
  const stream = new ReadableStream<UIMessageChunk>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  let message: SupportUIMessage | undefined;
  for await (const snapshot of readUIMessageStream<SupportUIMessage>({ stream }))
    message = snapshot;
  if (message === undefined) throw new Error("The answer's stream held no message.");
  return message;
}

function tokenUsage(message: SupportUIMessage): TokenUsage | null {
  const usage = message.metadata?.usage;
  if (usage === undefined) return null;
  const { inputTokens = null, outputTokens = null, totalTokens = null } = usage;
  return { inputTokens, outputTokens, totalTokens };
}

export async function runTicket({
  ticket,
  model,
  retriever,
  customers = storeData.customers,
}: RunOptions & { ticket: Ticket }): Promise<TicketOutcome> {
  const customer = customers.find(({ id }) => id === ticket.persona);
  if (!customer)
    throw new Error(`Ticket ${ticket.id} asks as an unknown customer: ${ticket.persona}`);

  const user: UIMessage = {
    id: `${ticket.id}-user`,
    role: "user",
    parts: [{ type: "text", text: ticket.message }],
  };
  const validated = await validateAndClean({ messages: [user] });
  if (!validated.ok)
    throw new Error(`Ticket ${ticket.id} is not a valid request: ${validated.text}`);

  const askedAt = new Date().toISOString();
  const started = performance.now();
  const chunks = await collect(
    streamSupportReply({
      model,
      retriever,
      messages: validated.messages,
      customer,
      locale: "en",
    }),
  );
  const latencyMs = Math.round(performance.now() - started);

  const failure = chunks.find((chunk) => chunk.type === "error");
  if (failure) return { abortReason: `the answer to ${ticket.id} failed: ${failure.errorText}` };
  if (chunks.some((chunk) => chunk.type === "abort")) {
    return { abortReason: `the answer to ${ticket.id} was aborted` };
  }
  const finish = chunks.findLast((chunk) => chunk.type === "finish");
  if (!finish) return { abortReason: `the answer to ${ticket.id} has no finish chunk` };

  const answer = { ...(await finishedMessage(chunks)), id: `${ticket.id}-answer` };
  const transcript = toTranscript(answer);
  const score = scoreTicket(ticket, transcript, customers);
  return {
    result: {
      id: ticket.id,
      kind: ticket.kind,
      persona: ticket.persona,
      message: ticket.message,
      askedAt,
      ...score,
      ...transcript,
      messages: [user as SupportUIMessage, answer],
      finishReason: finish.finishReason ?? null,
      usage: tokenUsage(answer),
      latencyMs,
    },
  };
}

/** Asks the tickets one after another, and stops at the first that cannot be scored. */
export async function runEval({
  tickets,
  onResult,
  ...options
}: RunOptions & {
  tickets: readonly Ticket[];
  onResult?: (result: TicketResult) => void;
}): Promise<{ results: TicketResult[]; abortReason: string | null }> {
  const results: TicketResult[] = [];
  for (const ticket of tickets) {
    const outcome = await runTicket({ ticket, ...options });
    if ("abortReason" in outcome) return { results, abortReason: outcome.abortReason };
    results.push(outcome.result);
    onResult?.(outcome.result);
  }
  return { results, abortReason: null };
}
