"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { useLocale } from "@/components/i18n/locale-provider";
import { AnalysisBlocks, Block, Facts } from "@/components/support/answer-analysis";
import { OutcomeChip, VerdictBadge } from "@/components/support/outcome";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TicketResult } from "@/lib/eval/record";
import { formatDateTime, formatMoney, formatStoreDay } from "@/lib/i18n/display";
import type { AnswerAnalysis, CustomerCard } from "@/lib/inbox/view";
import { cn } from "@/lib/utils";

function Details({ result, customer }: { result: TicketResult; customer: CustomerCard | null }) {
  const { locale, t } = useLocale();
  return (
    <div className="flex flex-col gap-6">
      {customer !== null && (
        <Block title={t.panel.customer}>
          <p className="font-medium">{customer.name}</p>
          <Facts
            rows={[
              [
                t.panel.email,
                <span key="email" className="font-mono text-xs">
                  {customer.email}
                </span>,
              ],
            ]}
          />
          <h4 className="mt-2 text-sm font-medium">{t.panel.orders}</h4>
          <ul className="flex flex-col gap-2">
            {customer.orders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border px-3 py-2"
              >
                <span className="font-mono text-xs">{order.id}</span>
                <Badge variant="secondary">{t.orderStatus[order.status]}</Badge>
                <span className="w-full text-xs text-muted-foreground">
                  {formatStoreDay(order.placedOn, locale)}
                  {" · "}
                  {formatMoney(order.total, locale)}
                </span>
              </li>
            ))}
          </ul>
        </Block>
      )}
      <Block title={t.panel.ticket}>
        <Facts
          rows={[
            [
              t.panel.ticket,
              <span key="id" className="font-mono text-xs">
                {result.id}
              </span>,
            ],
            [t.panel.group, t.kind[result.kind]],
            [t.panel.asked, formatDateTime(result.askedAt, locale)],
          ]}
        />
      </Block>
    </div>
  );
}

function Analysis({ result, analysis }: { result: TicketResult; analysis: AnswerAnalysis }) {
  const { t } = useLocale();

  return (
    <div className="flex flex-col gap-6">
      <Block title={t.panel.result}>
        <Facts
          rows={[
            [t.panel.expected, <OutcomeChip key="expected" outcome={result.expected} />],
            [t.panel.actual, <OutcomeChip key="actual" outcome={result.actual} />],
            [t.panel.result, <VerdictBadge key="verdict" pass={result.pass} />],
          ]}
        />
        <h4 className="mt-2 text-sm font-medium">{t.panel.why}</h4>
        <ul data-testid="checks" className="flex flex-col gap-1.5">
          {result.checks.map((check) => (
            <li key={check.id} data-check={check.id} data-ok={check.ok} className="flex gap-2">
              {check.ok ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              ) : (
                <CircleX className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <span className="flex min-w-0 flex-col gap-1">
                <span>
                  {t.check[check.id]}
                  <span className="sr-only">
                    {": "}
                    {check.ok ? t.panel.checkOk : t.panel.checkFailed}
                  </span>
                </span>
                {check.detail !== undefined && check.detail.length > 0 && (
                  <span lang="en" className="flex flex-wrap gap-1">
                    {check.detail.map((detail) => (
                      <code
                        key={detail}
                        className="rounded-sm bg-muted px-1 py-0.5 font-mono text-xs wrap-anywhere"
                      >
                        {detail}
                      </code>
                    ))}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Block>

      <AnalysisBlocks analysis={analysis} />
    </div>
  );
}

type ConversationPanelProps = {
  result: TicketResult;
  customer: CustomerCard | null;
  analysis: AnswerAnalysis;
  className?: string;
};

/**
 * The right panel (spec §1, item 3): Details (the customer and the ticket) and Analysis (expected
 * and actual outcome and why it passed or failed, the retrieved passages and their scores, the
 * tool calls, tokens and latency). Analysis opens first: it is what the eval run recorded.
 */
export function ConversationPanel({
  result,
  customer,
  analysis,
  className,
}: ConversationPanelProps) {
  const { t } = useLocale();
  return (
    <aside aria-label={t.panel.label} className={cn("min-w-0 text-sm", className)}>
      <Tabs defaultValue="analysis" className="gap-0">
        <div className="sticky top-0 z-10 border-b bg-background px-4 py-2">
          <TabsList className="pointer-coarse:h-12">
            <TabsTrigger value="details" className="px-3 pointer-coarse:min-h-11">
              {t.panel.details}
            </TabsTrigger>
            <TabsTrigger value="analysis" className="px-3 pointer-coarse:min-h-11">
              {t.panel.analysis}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="details" className="px-4 py-4">
          <Details result={result} customer={customer} />
        </TabsContent>
        <TabsContent value="analysis" className="px-4 py-4">
          <Analysis result={result} analysis={analysis} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
