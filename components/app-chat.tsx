"use client";

import { DefaultChatTransport } from "ai";
import { useMemo } from "react";
import { Chat } from "@/components/chat/chat";
import { useLocale } from "@/components/i18n/locale-provider";

type AppChatProps = {
  modelLabel: string;
  isMock: boolean;
  commit: string;
  rateLimitPerHour: number;
  /** The customer id the conversation is held as (spec §4); the route validates it. */
  persona: string;
};

/**
 * The project's chat (X-01 design §4.2, §4.3). Project-owned. A server page cannot pass functions
 * to a client component, so this client wrapper is where a project passes Chat's other props: a
 * transport, maxMessages, renderAssistant or hasContent. P1's transport adds the persona to every
 * request body (spec §4); it still posts the whole history, so the message cap stays on.
 */
export function AppChat({ modelLabel, isMock, commit, rateLimitPerHour, persona }: AppChatProps) {
  const { t } = useLocale();
  const transport = useMemo(() => new DefaultChatTransport({ body: { persona } }), [persona]);

  return (
    <Chat
      modelLabel={modelLabel}
      isMock={isMock}
      commit={commit}
      rateLimitPerHour={rateLimitPerHour}
      transport={transport}
      empty={{ title: t.empty.title, intro: t.empty.subtitle, groups: [{ prompts: t.prompts }] }}
    />
  );
}
