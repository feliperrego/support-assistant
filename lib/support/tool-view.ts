import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { ToolCallRecord } from "@/lib/eval/transcript";

/**
 * One tool call as the screens show it (spec §1 items 2 and 3): a chip in the conversation and a
 * row in the Analysis tab. The live chat reads it from a message's tool parts, the inbox from a
 * recorded transcript, so both show the same thing. Pure and client-safe.
 */
export type ToolView = {
  id: string;
  name: string;
  /** The input as far as it has streamed. */
  input: unknown;
  output?: unknown;
  error?: string;
  state: "running" | "done" | "error";
};

/** The handOff tool's name: it shows as the hand-off card, not as a chip. */
export const HAND_OFF_TOOL = "handOff";

/** The tool calls of a message, in order. */
export function toolViewsOf(message: UIMessage): ToolView[] {
  return message.parts.flatMap((part): ToolView[] => {
    if (!isToolUIPart(part)) return [];
    const base = { id: part.toolCallId, name: getToolName(part), input: part.input };
    if (part.state === "output-available") return [{ ...base, output: part.output, state: "done" }];
    if (part.state === "output-error") return [{ ...base, error: part.errorText, state: "error" }];
    return [{ ...base, state: "running" }];
  });
}

/** A recorded tool call (lib/eval/transcript.ts) as a view. */
export function toolViewOfRecord(record: ToolCallRecord): ToolView {
  const base = { id: record.toolCallId, name: record.toolName, input: record.input };
  if (record.error !== undefined) return { ...base, error: record.error, state: "error" };
  if ("output" in record) return { ...base, output: record.output, state: "done" };
  return { ...base, state: "running" };
}

/** A string field of a tool's input or output, or undefined. */
export function stringField(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : undefined;
}
