import { Fragment, type ReactNode, useMemo } from "react";
import { Citation } from "@/components/rag/citation";
import { InlineCode } from "@/components/rag/inline-code";
import { SourcesList } from "@/components/rag/sources-list";
import { HandOffCard } from "@/components/support/hand-off-card";
import { ToolCall } from "@/components/support/tool-call";
import { hasVisibleText } from "@/lib/chat/ui";
import { createAnswerChecker } from "@/lib/rag/answer";
import { messageSources } from "@/lib/rag/message";
import type { SupportUIMessage } from "@/lib/support/message";
import { HAND_OFF_TOOL, toolViewsOf } from "@/lib/support/tool-view";

/**
 * The answer's text: every text part the model wrote, a blank line apart, as the eval's transcript
 * joins them (lib/eval/transcript.ts).
 */
export function answerText(message: SupportUIMessage): string {
  return message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n\n");
}

/** Chat's hasContent for P1: an answer with no text yet still shows its tool calls. */
export function hasAnswerContent(message: SupportUIMessage): boolean {
  return hasVisibleText(message) || toolViewsOf(message).length > 0;
}

type AssistantMessageProps = {
  message: SupportUIMessage;
  /** The message is still streaming: an unfinished marker stays hidden (#2's R-09). */
  streaming: boolean;
  /** The caption row (Stopped, Cut, Regenerate), or null; it goes last. */
  caption?: ReactNode;
  /** The language of the model's words when it is known: "en" for a recorded eval ticket. */
  contentLang?: string;
};

/**
 * One answer (spec §1, item 2), in the live chat and in the inbox: the text with #2's [n]
 * popovers and verified/not-found badges, then a chip for each order lookup with its input and
 * output, the hand-off card, #2's Sources list and the caption. It keeps the shell's renderer
 * contract (template spec §5.8): data-message-role="assistant" on the root, the answer text as its
 * first child div, the caption last.
 */
export function AssistantMessage({
  message,
  streaming,
  caption = null,
  contentLang,
}: AssistantMessageProps) {
  const text = answerText(message);
  const sources = messageSources(message);
  // One checker per data-sources part, so each marker is verified once while the text streams.
  const check = useMemo(() => createAnswerChecker(sources), [sources]);
  const { parts, cited } = useMemo(() => check(text, { streaming }), [check, text, streaming]);
  const tools = toolViewsOf(message);
  const steps = tools.filter(({ name }) => name !== HAND_OFF_TOOL);
  const handOffs = tools.filter(({ name }) => name === HAND_OFF_TOOL);

  return (
    <div data-message-role="assistant" className="flex min-w-0 flex-col gap-2">
      {/* Re-parsed from the accumulated text at every chunk (#2 spec §6.2). */}
      <div lang={contentLang} className="whitespace-pre-wrap wrap-anywhere">
        {parts.map((part, i) =>
          part.type === "text" ? (
            <Fragment key={i}>{part.text}</Fragment>
          ) : part.type === "code" ? (
            <InlineCode key={i}>{part.text}</InlineCode>
          ) : (
            <Citation key={i} part={part} />
          ),
        )}
      </div>
      {steps.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {steps.map((view) => (
            <li key={view.id}>
              <ToolCall view={view} />
            </li>
          ))}
        </ul>
      )}
      {handOffs.map((view) => (
        <HandOffCard key={view.id} view={view} contentLang={contentLang} />
      ))}
      {cited.length > 0 && <SourcesList cited={cited} />}
      {caption}
    </div>
  );
}
