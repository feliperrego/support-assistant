// Copied from rag-citations (#2) components/rag/citation.tsx (P1 spec §4). Changes: format() comes from
// the template's lib/i18n/format.ts, and the link opens the passage's Help Center section (spec §1, item 5)
// instead of GitHub. "spec" in the comments below means the rag-citations spec, and R-nn/S-nn are its
// decisions.
import { CircleAlert, CircleCheck, ExternalLink } from "lucide-react";
import { useLocale } from "@/components/i18n/locale-provider";
import { TextWithCode } from "@/components/rag/inline-code";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import type { CheckedAttempt } from "@/lib/rag/answer";
import type { CitationStatus } from "@/lib/rag/verify";
import { cn } from "@/lib/utils";

/** The dictionary entry of each status's badge (spec §7.1). */
const STATUS_TEXT: Record<CitationStatus, keyof Messages["citation"]> = {
  verified: "verified",
  "not-found": "notFound",
  "unknown-source": "unknownSource",
  malformed: "malformed",
};

// Inline in the text. On a coarse pointer the padding makes a 44 px target (spec §7) and the
// negative margin keeps the line height; bg-clip-content keeps the highlight on the label.
const TRIGGER_CLASS =
  "rounded-sm bg-clip-content px-0.5 font-medium tabular-nums underline underline-offset-4 " +
  "outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 " +
  "aria-expanded:bg-muted pointer-coarse:-my-3 pointer-coarse:py-3";

/** How the answer and the Sources list show passage n. */
export function citationLabel(n: number): string {
  return `[${n}]`;
}

/**
 * A citation's status in its popover. Its text is darker than the variants', as VerdictBadge's
 * (components/support/outcome.tsx), so it reads at 4.5:1 or more on its tint (P1 spec §7, E1;
 * pinned by e2e/desk.spec.ts). Light only: nothing sets `.dark`.
 */
function StatusBadge({ status }: { status: CitationStatus }) {
  const { t } = useLocale();
  const verified = status === "verified";
  return (
    <Badge
      variant={verified ? "secondary" : "destructive"}
      data-citation-status={status}
      className={cn(verified ? "bg-emerald-600/10 text-emerald-800" : "text-red-700")}
    >
      {verified ? <CircleCheck /> : <CircleAlert />}
      {t.citation[STATUS_TEXT[status]]}
    </Badge>
  );
}

/** Keeps the marked quote in view: a passage can be far taller than its box. */
function scrollToMark(element: HTMLDivElement | null): void {
  const mark = element?.querySelector("mark");
  if (element == null || mark == null) return;
  element.scrollTop = mark.offsetTop - element.clientHeight / 3;
}

type PassageProps = {
  text: string;
  /** A verified quote's offsets in the text (spec §6.3). */
  match: { start: number; end: number } | null;
};

/** The one passage string as it is (S-22), with a verified quote in <mark>. */
function Passage({ text, match }: PassageProps) {
  return (
    // Focusable, so that a keyboard can scroll it.
    <div
      ref={scrollToMark}
      tabIndex={0}
      lang="en"
      className="relative max-h-60 overflow-y-auto rounded-md bg-muted/50 p-2 font-mono text-xs leading-relaxed whitespace-pre-wrap wrap-anywhere outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {match === null ? (
        text
      ) : (
        <>
          {text.slice(0, match.start)}
          <mark className="rounded-sm bg-yellow-200 text-foreground">
            {text.slice(match.start, match.end)}
          </mark>
          {text.slice(match.end)}
        </>
      )}
    </div>
  );
}

/**
 * One citation attempt in the answer (spec §7, R-13): an inline button that opens a popover
 * with the cited passage's heading and file, the status badge, the passage with the quote
 * marked, and a link to its Help Center section. An unknown source or a malformed attempt shows
 * its badge only. The button's data-citation-verified is the one the measurement reads (spec
 * §6.3, R-14).
 */
export function Citation({ part: { attempt, verification, source } }: { part: CheckedAttempt }) {
  const { t } = useLocale();
  const { status } = verification;
  const statusText = t.citation[STATUS_TEXT[status]];

  return (
    <Popover>
      <PopoverTrigger
        // A marker shows [n], named by its source; a malformed attempt shows what the model
        // wrote, named by its status (S-12).
        aria-label={
          attempt.type === "citation" ? format(t.citation.button, { n: attempt.n }) : statusText
        }
        data-citation-verified={String(status === "verified")}
        className={cn(
          TRIGGER_CLASS,
          status === "verified"
            ? "decoration-muted-foreground/60 decoration-dotted"
            : "text-destructive decoration-destructive/60 decoration-wavy",
        )}
      >
        {attempt.type === "citation" ? citationLabel(attempt.n) : attempt.raw}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label={source === null ? statusText : undefined}
        // A badge alone fits its text; a passage gets a wide box, never wider than the screen.
        className={source === null ? "w-auto" : "w-[min(28rem,calc(100vw-2rem))]"}
      >
        {source === null ? (
          <StatusBadge status={status} />
        ) : (
          <>
            <PopoverHeader>
              <PopoverTitle lang="en">
                <TextWithCode text={source.heading} />
              </PopoverTitle>
              <PopoverDescription lang="en" className="font-mono text-xs">
                {source.file}
              </PopoverDescription>
            </PopoverHeader>
            <StatusBadge status={status} />
            {/* A quote that is not in its passage can't be marked, so it is shown as claimed. */}
            {attempt.type === "citation" && status === "not-found" && (
              <blockquote lang="en" className="border-l-2 border-destructive/40 pl-2 italic">
                {`“${attempt.quote}”`}
              </blockquote>
            )}
            <Passage
              text={source.text}
              match={verification.status === "verified" ? verification : null}
            />
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 self-start underline underline-offset-4 pointer-coarse:min-h-11"
            >
              {t.citation.viewSource}
              <ExternalLink className="size-3.5" />
            </a>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
