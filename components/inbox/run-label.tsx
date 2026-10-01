"use client";

import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { formatDay } from "@/lib/i18n/display";
import { format } from "@/lib/i18n/format";
import type { RunLabel } from "@/lib/inbox/run";

/**
 * Which eval run a screen shows (P-09): its date, model and commit, and for a mock run a badge
 * that says it is not a measurement (ROADMAP Q11).
 */
export function RunLabelView({ run }: { run: RunLabel }) {
  const { locale, t } = useLocale();
  const commit = format(t.run.commit, { commit: run.commit });
  return (
    <div data-testid="run-label" className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{t.run.label}</span>
      <span>
        {format(t.run.recorded, { date: formatDay(run.date, locale) })}
        {" · "}
        {format(t.run.model, { model: run.model })}
        {" · "}
        <span className="font-mono">{commit}</span>
        {run.dirty && ` (${t.run.dirty})`}
      </span>
      {run.mock && (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge variant="outline" className="border-amber-500/60 text-amber-800">
            {t.run.mock}
          </Badge>
          <span>{t.run.mockNote}</span>
        </span>
      )}
    </div>
  );
}
