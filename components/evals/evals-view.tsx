"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { RunLabelView } from "@/components/inbox/run-label";
import { OutcomeChip, VerdictBadge } from "@/components/support/outcome";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { evalsHeadline } from "@/lib/evals/headline";
import type { EvalsData } from "@/lib/evals/view";
import { formatDay, formatNumber, formatSeconds } from "@/lib/i18n/display";
import { format } from "@/lib/i18n/format";
import { REPO_URL } from "@/lib/project";
import { cn } from "@/lib/utils";

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-lg font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}

function Heading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-lg font-semibold">
      {children}
    </h3>
  );
}

/**
 * The Evals page (spec §1 item 6, §5): the headline with its 95% CI, the supporting data, the
 * expected × actual outcome matrix, the per-ticket table linking to the transcripts in the inbox,
 * and the run's metadata. Measured numbers only, all from the run file (ROADMAP Q11); a mock run
 * gets a statement instead of a rate (lib/evals/headline.ts).
 */
export function EvalsView({ data }: { data: EvalsData }) {
  const { locale, t } = useLocale();
  const { summary, kinds, outcomes } = data;
  const shown = evalsHeadline({ ...data, interval: summary.interval }, t);
  const number = (value: number, digits = 0) => formatNumber(value, locale, digits);
  const seconds = (ms: number) => format(t.panel.seconds, { n: formatSeconds(ms, locale) });

  return (
    <div className="mx-auto flex w-full max-w-5xl min-w-0 flex-col gap-10 px-4 py-8">
      <div className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">{t.evals.title}</h2>
        <RunLabelView run={data.run} />
      </div>

      <section aria-labelledby="headline" className="flex flex-col gap-2">
        <p
          id="headline"
          data-testid="headline"
          className={cn(
            "font-semibold tracking-tight",
            shown.interval === null ? "text-xl" : "text-3xl",
          )}
        >
          {shown.headline}
        </p>
        {shown.interval !== null && (
          <p data-testid="interval" className="text-lg text-muted-foreground">
            {shown.interval}
          </p>
        )}
        {shown.passed !== null && <p>{shown.passed}</p>}
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t.evals.about} {t.evals.portuguese}
        </p>
      </section>

      <section aria-labelledby="by-kind" className="flex flex-col gap-3">
        <Heading id="by-kind">{t.evals.byKind}</Heading>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kinds.map((kind) => (
            <Stat
              key={kind}
              label={t.kind[kind]}
              value={format(t.evals.ofTotal, {
                n: summary.byKind[kind].passed,
                total: summary.byKind[kind].tickets,
              })}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="supporting" className="flex flex-col gap-3">
        <Heading id="supporting">{t.evals.supporting}</Heading>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat
            label={t.evals.citations}
            value={format(t.evals.ofTotal, {
              n: summary.citations.verified,
              total: summary.citations.attempts,
            })}
          />
          <Stat label={t.evals.medianLatency} value={seconds(summary.latency.medianMs)} />
          <Stat label={t.evals.slowest} value={seconds(summary.latency.maxMs)} />
          <Stat
            label={t.evals.medianTokens}
            value={
              summary.tokens.medianPerTicket === null
                ? t.panel.notReported
                : number(summary.tokens.medianPerTicket)
            }
          />
          <Stat label={t.evals.allTokens} value={number(summary.tokens.total)} />
          <Stat label={t.evals.otherOrders} value={number(summary.otherCustomersOrdersAsked)} />
        </div>
      </section>

      <section aria-labelledby="matrix" className="flex min-w-0 flex-col gap-3">
        <Heading id="matrix">{t.evals.matrix}</Heading>
        <Table data-testid="matrix">
          <TableCaption className="text-left">{t.evals.matrixCaption}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{`${t.panel.expected} \\ ${t.panel.actual}`}</TableHead>
              {outcomes.map((actual) => (
                <TableHead key={actual} className="text-center">
                  {t.outcome[actual]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {outcomes.map((expected) => (
              <TableRow key={expected}>
                <TableHead scope="row">{t.outcome[expected]}</TableHead>
                {outcomes.map((actual) => {
                  const count = summary.matrix[expected][actual];
                  return (
                    // A mismatch's red is a shade darker than text-destructive, so it reads at
                    // 4.5:1 or more on its tint (spec §7, E1; pinned by e2e/desk.spec.ts).
                    <TableCell
                      key={actual}
                      className={cn(
                        "text-center tabular-nums",
                        expected === actual ? "font-semibold" : "",
                        count === 0 && "text-muted-foreground/60",
                        count > 0 && expected !== actual && "bg-destructive/10 text-red-700",
                      )}
                    >
                      {count}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section aria-labelledby="tickets" className="flex min-w-0 flex-col gap-3">
        <Heading id="tickets">{t.evals.tickets}</Heading>
        <Table data-testid="tickets">
          <TableHeader>
            <TableRow>
              <TableHead>{t.panel.ticket}</TableHead>
              <TableHead>{t.panel.group}</TableHead>
              <TableHead>{t.panel.customer}</TableHead>
              <TableHead>{t.panel.expected}</TableHead>
              <TableHead>{t.panel.actual}</TableHead>
              <TableHead>{t.panel.result}</TableHead>
              <TableHead className="text-right">{t.panel.latency}</TableHead>
              <TableHead className="text-right">{t.panel.usage}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.tickets.map((row) => (
              <TableRow key={row.id} data-ticket={row.id}>
                <TableCell>
                  <Link
                    href={`/inbox/${row.id}#conversation`}
                    aria-label={format(t.evals.open, { id: row.id })}
                    className="font-mono underline underline-offset-4"
                  >
                    {row.id}
                  </Link>
                </TableCell>
                <TableCell>{t.kind[row.kind]}</TableCell>
                <TableCell>{row.customer}</TableCell>
                <TableCell>
                  <OutcomeChip outcome={row.expected} />
                </TableCell>
                <TableCell>
                  <OutcomeChip outcome={row.actual} />
                </TableCell>
                <TableCell>
                  <VerdictBadge pass={row.pass} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{seconds(row.latencyMs)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.totalTokens === null ? t.panel.notReported : number(row.totalTokens)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section aria-labelledby="metadata" className="flex flex-col gap-3">
        <Heading id="metadata">{t.evals.metadata}</Heading>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
          <dt className="text-muted-foreground">{t.evals.date}</dt>
          <dd>{formatDay(data.run.date, locale)}</dd>
          <dt className="text-muted-foreground">{t.evals.model}</dt>
          <dd className="font-mono">{data.run.model}</dd>
          <dt className="text-muted-foreground">{t.evals.commit}</dt>
          <dd className="font-mono">
            {data.run.commit}
            {data.run.dirty && ` (${t.run.dirty})`}
          </dd>
          <dt className="text-muted-foreground">{t.evals.ticketSet}</dt>
          <dd className="wrap-anywhere">
            {format(t.evals.frozen, {
              n: data.ticketSet.tickets,
              date: formatDay(`${data.ticketSet.frozenOn}T00:00:00.000Z`, locale),
            })}
            {" · "}
            <span className="font-mono text-xs">{`SHA-256 ${data.ticketSet.sha256.slice(0, 12)}`}</span>
          </dd>
          <dt className="text-muted-foreground">{t.evals.index}</dt>
          <dd className="wrap-anywhere">
            {format(t.evals.passagesCount, { n: data.index.chunks, model: data.index.model })}
            {" · "}
            <span className="font-mono text-xs">{`SHA-256 ${data.index.corpusHash.slice(0, 12)}`}</span>
          </dd>
          {shown.method !== null && (
            <>
              <dt className="text-muted-foreground">{t.evals.method}</dt>
              <dd>{shown.method}</dd>
            </>
          )}
          <dt className="text-muted-foreground">{t.evals.rawData}</dt>
          <dd>
            <a
              href={`${REPO_URL}/blob/main/${data.file}`}
              className="inline-flex items-center gap-1 font-mono text-xs underline underline-offset-4 wrap-anywhere"
            >
              {data.file}
              <ExternalLink className="size-3.5 shrink-0" />
            </a>
          </dd>
        </dl>
      </section>
    </div>
  );
}
