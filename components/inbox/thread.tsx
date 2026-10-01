"use client";

import { useId } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { AssistantMessage } from "@/components/support/assistant-message";
import { OutcomeChip, VerdictBadge } from "@/components/support/outcome";
import { Button } from "@/components/ui/button";
import type { TicketResult } from "@/lib/eval/record";
import { format } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

type ThreadProps = {
  result: TicketResult;
  /** The customer's name, or the run's customer id. */
  customer: string;
  className?: string;
};

/**
 * One recorded conversation (spec §1, item 2): the customer's message and the assistant's answer,
 * rendered as the live chat renders it, under the customer's name, the outcome chip and the
 * pass/fail badge. "Take over" and "Close" are visible but static (spec §1; ROADMAP S9). The
 * tickets are English, so the recorded text is marked lang="en".
 */
export function Thread({ result, customer, className }: ThreadProps) {
  const { t } = useLocale();
  const titleId = useId();
  const noteId = useId();

  return (
    <section
      id="conversation"
      aria-labelledby={titleId}
      data-testid="thread"
      className={cn("flex min-w-0 scroll-mt-4 flex-col", className)}
    >
      <div className="flex flex-col gap-2 border-b px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <h2 id={titleId} className="font-semibold wrap-anywhere">
              {customer}
            </h2>
            <p className="text-xs text-muted-foreground">
              {format(t.thread.ticket, { id: result.id })}
              {" · "}
              {t.kind[result.kind]}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <OutcomeChip outcome={result.actual} />
            <VerdictBadge pass={result.pass} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled aria-describedby={noteId}>
            {t.thread.takeOver}
          </Button>
          <Button variant="outline" size="sm" disabled aria-describedby={noteId}>
            {t.thread.close}
          </Button>
          <span id={noteId} className="text-xs text-muted-foreground">
            {t.thread.staticNote}
          </span>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
        {result.messages.map((message) =>
          message.role === "user" ? (
            <div
              key={message.id}
              lang="en"
              data-message-role="user"
              className="ml-auto max-w-[85%] rounded-2xl bg-muted px-4 py-2 whitespace-pre-wrap wrap-anywhere"
            >
              {message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")}
            </div>
          ) : (
            <AssistantMessage
              key={message.id}
              message={message}
              streaming={false}
              contentLang="en"
            />
          ),
        )}
      </div>
    </section>
  );
}
