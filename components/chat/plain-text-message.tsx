import type { UIMessage } from "ai";
import type { ReactNode } from "react";
import type { AssistantRenderer } from "@/components/chat/message-list";
import { messageText } from "@/lib/chat/ui";

type PlainTextMessageProps = {
  message: UIMessage;
  /** The caption row under the answer (Stopped, Cut, Regenerate), or null. */
  caption: ReactNode;
};

/**
 * The default assistant renderer (X-01 design §4.3): the answer's text parts as plain text, with
 * no Markdown, which the default instructions ask the model not to write. It keeps the renderer
 * contract: data-message-role="assistant" on the root, the answer text as its first child div,
 * and the caption last.
 */
export function PlainTextMessage({ message, caption }: PlainTextMessageProps) {
  return (
    <div data-message-role="assistant" className="flex flex-col gap-2">
      <div className="whitespace-pre-wrap wrap-anywhere">{messageText(message)}</div>
      {caption}
    </div>
  );
}

/** Chat's default `renderAssistant`. */
export const renderPlainText: AssistantRenderer<UIMessage> = (message, { caption }) => (
  <PlainTextMessage message={message} caption={caption} />
);
