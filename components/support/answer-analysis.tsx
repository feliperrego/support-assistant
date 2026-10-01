"use client";

import { ChevronDown, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { citationLabel } from "@/components/rag/citation";
import { ToolCall } from "@/components/support/tool-call";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatNumber, formatSeconds } from "@/lib/i18n/display";
import { format } from "@/lib/i18n/format";
import { type AnswerAnalysis, hasAnalysis, liveAnalysisOf } from "@/lib/support/analysis";
import type { SupportUIMessage } from "@/lib/support/message";
import { toolViewOfRecord } from "@/lib/support/tool-view";

/** A titled block of the Analysis. */
export function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** Label and value rows. */
export function Facts({ rows }: { rows: readonly (readonly [string, ReactNode])[] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="wrap-anywhere">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The parts of an answer's Analysis that any answer has (spec §1, item 3): the retrieved passages
 * and their scores, the tool calls, then the tokens and latency. The inbox's right panel shows
 * them under the eval result; the live chat under each finished answer.
 */
export function AnalysisBlocks({ analysis }: { analysis: AnswerAnalysis }) {
  const { locale, t } = useLocale();
  const { usage } = analysis;
  const tokens = (count: number | null | undefined) =>
    count == null ? t.panel.notReported : formatNumber(count, locale);

  return (
    <>
      <Block title={t.panel.passages}>
        <p className="text-xs text-muted-foreground">{t.panel.passagesNote}</p>
        {analysis.retrieval !== null && (
          <Facts
            rows={[
              [t.panel.bestScore, formatNumber(analysis.retrieval.topScore, locale, 3)],
              [
                t.panel.searchTime,
                format(t.panel.milliseconds, {
                  n: formatNumber(analysis.retrieval.searchMs, locale, 1),
                }),
              ],
            ]}
          />
        )}
        <ol className="flex flex-col gap-1.5">
          {analysis.passages.map((passage) => (
            <li
              key={passage.number}
              data-passage={passage.number}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
            >
              <span className="text-muted-foreground tabular-nums">
                {citationLabel(passage.number)}
              </span>
              <a
                href={passage.url}
                target="_blank"
                rel="noopener noreferrer"
                lang="en"
                className="min-w-0 flex-1 underline underline-offset-4 wrap-anywhere"
              >
                {passage.heading}
                <ExternalLink className="ml-1 inline size-3.5 align-[-0.125em]" />
              </a>
              <span className="text-xs text-muted-foreground tabular-nums">
                {format(t.panel.score, { score: formatNumber(passage.score, locale, 3) })}
              </span>
              {passage.cited && <Badge variant="secondary">{t.panel.cited}</Badge>}
            </li>
          ))}
        </ol>
      </Block>

      <Block title={t.panel.toolCalls}>
        {analysis.toolCalls.length === 0 ? (
          <p className="text-muted-foreground">{t.panel.noToolCalls}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {analysis.toolCalls.map((call) => (
              <li key={call.toolCallId}>
                <ToolCall view={toolViewOfRecord(call)} />
              </li>
            ))}
          </ul>
        )}
      </Block>

      <Block title={t.panel.usage}>
        <div data-testid="usage">
          <Facts
            rows={[
              [t.panel.inputTokens, tokens(usage?.inputTokens)],
              [t.panel.outputTokens, tokens(usage?.outputTokens)],
              [t.panel.totalTokens, tokens(usage?.totalTokens)],
              [
                t.panel.latency,
                analysis.latencyMs === null
                  ? t.panel.notReported
                  : format(t.panel.seconds, { n: formatSeconds(analysis.latencyMs, locale) }),
              ],
            ]}
          />
        </div>
      </Block>
    </>
  );
}

/**
 * The Analysis of a finished live answer (spec §1, item 3), collapsed under it in "Try as a
 * customer": the same blocks as the inbox's panel, built from the message (liveAnalysisOf). The
 * panel mounts only when opened, so a closed one adds no passages or tool chips to the answer. An
 * answer with nothing to analyse gets no toggle.
 */
export function LiveAnalysis({ message }: { message: SupportUIMessage }) {
  const { t } = useLocale();
  const analysis = liveAnalysisOf(message);
  if (!hasAnalysis(analysis)) return null;
  return (
    <Collapsible className="text-sm">
      <CollapsibleTrigger className="group inline-flex items-center gap-1 rounded-md text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11">
        {t.panel.analysis}
        <ChevronDown className="size-3.5 transition-transform group-data-panel-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent
        data-testid="answer-analysis"
        className="mt-2 flex flex-col gap-6 rounded-lg border px-3 py-3"
      >
        <AnalysisBlocks analysis={analysis} />
      </CollapsibleContent>
    </Collapsible>
  );
}
