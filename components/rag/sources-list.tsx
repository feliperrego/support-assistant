// Copied from rag-citations (#2) components/rag/sources-list.tsx (P1 spec §4). Changes: format() comes
// from the template's lib/i18n/format.ts, and each passage links to its Help Center section (spec §1,
// item 5) instead of GitHub. "spec" in the comments below means the rag-citations spec.
import { ExternalLink } from "lucide-react";
import { useId } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { citationLabel } from "@/components/rag/citation";
import { TextWithCode } from "@/components/rag/inline-code";
import { format } from "@/lib/i18n/format";
import type { CitedSource } from "@/lib/rag/answer";
import { cn } from "@/lib/utils";

/**
 * Sources, always visible below the answer (spec §7, R-13): the distinct cited passages in
 * order of first citation, each with its per-quote result. Retrieved passages that were not
 * cited are not listed (S-16). Each links to its Help Center section, so nothing needs the popover.
 */
export function SourcesList({ cited }: { cited: readonly CitedSource[] }) {
  const { t } = useLocale();
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm"
    >
      <h2 id={titleId} className="text-xs font-medium text-muted-foreground">
        {t.sources.title}
      </h2>
      <ol className="flex flex-col gap-1">
        {cited.map(({ source, verified, total }) => (
          <li key={source.number} className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-muted-foreground tabular-nums">
              {citationLabel(source.number)}
            </span>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              lang="en"
              className="underline underline-offset-4 pointer-coarse:inline-block pointer-coarse:py-3"
            >
              <TextWithCode text={source.heading} />
              <ExternalLink className="ml-1 inline size-3.5 align-[-0.125em]" />
            </a>
            <span lang="en" className="font-mono text-xs text-muted-foreground">
              {source.file}
            </span>
            <span
              className={cn(
                "text-xs",
                verified === total ? "text-muted-foreground" : "text-destructive",
              )}
            >
              {format(t.sources.summary, { verified, total })}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
