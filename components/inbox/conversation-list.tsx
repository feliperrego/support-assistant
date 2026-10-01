"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { RunLabelView } from "@/components/inbox/run-label";
import { OutcomeChip, VerdictBadge } from "@/components/support/outcome";
import { format } from "@/lib/i18n/format";
import type { RunLabel } from "@/lib/inbox/run";
import type { ConversationSummary } from "@/lib/inbox/view";
import { cn } from "@/lib/utils";

type ConversationListProps = {
  run: RunLabel;
  conversations: readonly ConversationSummary[];
  selectedId: string;
  className?: string;
};

/**
 * The inbox's conversation list (spec §1, item 1): the last eval run's tickets, each with its
 * customer, message, outcome chip and pass/fail badge, under the run's date, model and commit.
 * It scrolls on its own and keeps the open conversation in view.
 */
export function ConversationList({
  run,
  conversations,
  selectedId,
  className,
}: ConversationListProps) {
  const { t } = useLocale();
  const titleId = useId();
  const scrollerRef = useRef<HTMLElement>(null);

  // Brings the open conversation into the list's view, without scrolling the window.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const item = scroller?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!scroller || !item) return;
    // Offsets are from the section, which is positioned; its sticky header covers the top.
    const header = (scroller.firstElementChild as HTMLElement | null)?.offsetHeight ?? 0;
    const top = item.offsetTop;
    const visible =
      top >= scroller.scrollTop + header &&
      top + item.offsetHeight <= scroller.scrollTop + scroller.clientHeight;
    if (!visible) scroller.scrollTop = top - header - scroller.clientHeight / 4;
  }, [selectedId]);

  return (
    <section
      ref={scrollerRef}
      aria-labelledby={titleId}
      className={cn("relative flex min-w-0 flex-col overflow-y-auto", className)}
    >
      <div className="sticky top-0 z-10 flex flex-col gap-2 border-b bg-background px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id={titleId} className="font-semibold">
            {t.inbox.title}
          </h2>
          <span className="text-xs text-muted-foreground">
            {format(t.inbox.count, { n: conversations.length })}
          </span>
        </div>
        <RunLabelView run={run} />
      </div>
      <nav aria-label={t.inbox.list}>
        <ul className="divide-y">
          {conversations.map((conversation) => {
            const selected = conversation.id === selectedId;
            return (
              <li key={conversation.id}>
                <Link
                  href={`/inbox/${conversation.id}#conversation`}
                  aria-current={selected ? "page" : undefined}
                  data-ticket={conversation.id}
                  className={cn(
                    "flex flex-col gap-1.5 px-4 py-3 outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                    selected && "bg-muted",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{conversation.customer}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {conversation.id}
                    </span>
                  </span>
                  <span lang="en" className="line-clamp-2 text-sm text-muted-foreground">
                    {conversation.message}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    <OutcomeChip outcome={conversation.actual} />
                    <VerdictBadge pass={conversation.pass} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </section>
  );
}
