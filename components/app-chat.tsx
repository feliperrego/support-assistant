"use client";

import { DefaultChatTransport } from "ai";
import { type ReactNode, useMemo, useState } from "react";
import { Chat } from "@/components/chat/chat";
import type { AssistantRenderer } from "@/components/chat/message-list";
import { useLocale } from "@/components/i18n/locale-provider";
import { AssistantMessage, hasAnswerContent } from "@/components/support/assistant-message";
import { PersonaPicker } from "@/components/try/persona-picker";
import type { SupportUIMessage } from "@/lib/support/message";
import type { PersonaOption } from "@/lib/support/persona";

export type AppChatProps = {
  modelLabel: string;
  isMock: boolean;
  commit: string;
  rateLimitPerHour: number;
  /** The customers a visitor can chat as (spec §1 item 4, P-05); the first is the default. */
  personas: readonly PersonaOption[];
  /**
   * The bar above the persona picker, given the chat's New chat button: the site header on
   * /try, the drawer's own bar in the drawer.
   */
  top: (newChat: ReactNode) => ReactNode;
  /** Shown before the picker: the link back to the desk on /try. */
  leading?: ReactNode;
};

const renderAnswer: AssistantRenderer<SupportUIMessage> = (message, { streaming, caption }) => (
  <AssistantMessage message={message} streaming={streaming} caption={caption} />
);

/**
 * The project's chat (X-01 design §4.2, §4.3), project-owned: "Try as a customer" (spec §1,
 * item 4). The visitor picks a persona; P1's transport adds it to every request body, where the
 * route validates it (spec §4). It still posts the whole history, so the message cap stays on.
 * Answers render with #2's citations, the tool chips and the hand-off card. Changing the persona
 * remounts the chat, so a conversation never mixes two customers. The conversation lives in the
 * browser only, in memory (ROADMAP Q8).
 */
export function AppChat({
  modelLabel,
  isMock,
  commit,
  rateLimitPerHour,
  personas,
  top,
  leading,
}: AppChatProps) {
  const { t } = useLocale();
  const [persona, setPersona] = useState(personas[0].id);
  const transport = useMemo(
    () => new DefaultChatTransport<SupportUIMessage>({ body: { persona } }),
    [persona],
  );

  return (
    <Chat<SupportUIMessage>
      key={persona}
      modelLabel={modelLabel}
      isMock={isMock}
      commit={commit}
      rateLimitPerHour={rateLimitPerHour}
      transport={transport}
      renderAssistant={renderAnswer}
      hasContent={hasAnswerContent}
      empty={{ title: t.empty.title, intro: t.empty.subtitle, groups: [{ prompts: t.prompts }] }}
      header={(newChat) => (
        <>
          {top(newChat)}
          <PersonaPicker
            personas={personas}
            value={persona}
            onChange={setPersona}
            leading={leading}
          />
        </>
      )}
    />
  );
}
