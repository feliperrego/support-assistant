"use client";

import { ConversationList } from "@/components/inbox/conversation-list";
import { ConversationPanel } from "@/components/inbox/conversation-panel";
import { Thread } from "@/components/inbox/thread";
import type { TicketResult } from "@/lib/eval/record";
import type { RunLabel } from "@/lib/inbox/run";
import type { AnswerAnalysis, ConversationSummary, CustomerCard } from "@/lib/inbox/view";

export type InboxViewProps = {
  run: RunLabel;
  conversations: readonly ConversationSummary[];
  /** The open conversation: its recorded result, its customer and its Analysis tab. */
  result: TicketResult;
  customer: CustomerCard | null;
  analysis: AnswerAnalysis;
};

/**
 * The inbox (spec §1 items 1–3, P-09): the conversation list, the thread and the right panel. On
 * a wide screen (xl) they are three columns that scroll on their own; at lg the panel goes under
 * the thread; below lg the three stack and the window scrolls (ROADMAP S7).
 */
export function InboxView({ run, conversations, result, customer, analysis }: InboxViewProps) {
  const name = customer?.name ?? result.persona;
  return (
    <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
      <ConversationList
        run={run}
        conversations={conversations}
        selectedId={result.id}
        className="max-h-[24rem] border-b lg:max-h-none lg:border-r lg:border-b-0"
      />
      <div className="flex min-w-0 flex-col lg:min-h-0 lg:overflow-y-auto xl:contents">
        <Thread result={result} customer={name} className="xl:min-h-0 xl:overflow-y-auto" />
        <ConversationPanel
          result={result}
          customer={customer}
          analysis={analysis}
          className="border-t xl:min-h-0 xl:overflow-y-auto xl:border-t-0 xl:border-l"
        />
      </div>
    </div>
  );
}
