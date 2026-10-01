import { CircleAlert, Headset, LoaderCircle } from "lucide-react";
import { useId } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { HAND_OFF_REASONS, type HandOffReason } from "@/lib/support/hand-off";
import { stringField, type ToolView } from "@/lib/support/tool-view";

function isReason(value: string | undefined): value is HandOffReason {
  return HAND_OFF_REASONS.includes(value as HandOffReason);
}

type HandOffCardProps = {
  /** The handOff call (lib/support/tools.ts): its input as far as it has streamed, then its output. */
  view: ToolView;
  /** The language of the AI's note when it is known: "en" for a recorded eval ticket. */
  contentLang?: string;
};

/**
 * The hand-off card (spec §1, item 2): the conversation went to a person, why, and the AI's note
 * for the team. The assistant never grants a refund or changes an order itself (spec §3).
 */
export function HandOffCard({ view, contentLang }: HandOffCardProps) {
  const { t } = useLocale();
  const titleId = useId();
  const done = view.state === "done";
  const running = view.state === "running";
  const reason = stringField(view.output, "reason") ?? stringField(view.input, "reason");
  const summary = stringField(view.output, "summary") ?? stringField(view.input, "summary");

  return (
    <section
      aria-labelledby={titleId}
      data-hand-off={view.state}
      className="flex flex-col gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
    >
      <h3 id={titleId} className="flex items-center gap-2 font-medium">
        {running ? (
          <LoaderCircle className="size-4 shrink-0 text-muted-foreground motion-safe:animate-spin" />
        ) : done ? (
          <Headset className="size-4 shrink-0 text-amber-700" />
        ) : (
          <CircleAlert className="size-4 shrink-0 text-destructive" />
        )}
        {done ? t.handOff.title : t.handOff.pending}
      </h3>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        {reason !== undefined && (
          <>
            <dt className="text-muted-foreground">{t.handOff.reason}</dt>
            <dd>{isReason(reason) ? t.handOff.reasons[reason] : reason}</dd>
          </>
        )}
        {summary !== undefined && (
          <>
            <dt className="text-muted-foreground">{t.handOff.note}</dt>
            <dd lang={contentLang} className="whitespace-pre-wrap wrap-anywhere">
              {summary}
            </dd>
          </>
        )}
      </dl>
      {done && <p className="text-muted-foreground">{t.handOff.next}</p>}
      {view.state === "error" && <p className="text-destructive">{t.tool.failed}</p>}
    </section>
  );
}
