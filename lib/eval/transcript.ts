import { getToolName, isToolUIPart } from "ai";
import { createAnswerChecker } from "@/lib/rag/answer";
import type { CitationAttempt } from "@/lib/rag/citations";
import { messageSources } from "@/lib/rag/message";
import type { CitationStatus } from "@/lib/rag/verify";
import type { SupportUIMessage } from "@/lib/support/message";

/**
 * What the scorer reads from one ticket's answer (spec §5): the reply, the tool calls with their
 * inputs and outputs, and each citation attempt with its verification, built from the pipeline's
 * finished message. Pure.
 */

/** One tool call of the answer, in order, with the output the server returned. */
export type ToolCallRecord = {
  toolCallId: string;
  toolName: string;
  input: unknown;
  /** Absent when the tool failed. */
  output?: unknown;
  /** The tool's error, when it failed. */
  error?: string;
};

/**
 * One citation attempt with its result, as #2's checker gives it (lib/rag/answer.ts), and the
 * article of the passage it cites: null for an unknown source or a malformed attempt.
 */
export type CitationRecord = CitationAttempt & { status: CitationStatus; article: string | null };

export type Transcript = {
  /** All the assistant's text in the answer, markers included. */
  reply: string;
  toolCalls: ToolCallRecord[];
  citations: CitationRecord[];
};

/** The text parts of an answer, one per text the model wrote, in order. */
function textParts(message: SupportUIMessage): string[] {
  return message.parts.flatMap((part) => (part.type === "text" ? [part.text] : []));
}

/**
 * Reduces a finished answer to its transcript (spec §5). The reply joins the text of every step,
 * a blank line apart. Each text part is checked on its own with #2's checker against the passages
 * of the data-sources part (lib/rag/answer.ts), as the chat's renderer checks it.
 */
export function toTranscript(message: SupportUIMessage): Transcript {
  const sources = messageSources(message);
  const check = createAnswerChecker(sources);
  const texts = textParts(message);

  const citations = texts.flatMap((text) =>
    check(text, { streaming: false }).parts.flatMap((part): CitationRecord[] =>
      part.type === "attempt"
        ? [
            {
              ...part.attempt,
              status: part.verification.status,
              article: part.source?.article ?? null,
            },
          ]
        : [],
    ),
  );

  const toolCalls = message.parts.flatMap((part): ToolCallRecord[] => {
    if (!isToolUIPart(part)) return [];
    const base = { toolCallId: part.toolCallId, toolName: getToolName(part), input: part.input };
    if (part.state === "output-available") return [{ ...base, output: part.output }];
    if (part.state === "output-error") return [{ ...base, error: part.errorText }];
    return [base];
  });

  return { reply: texts.join("\n\n"), toolCalls, citations };
}
