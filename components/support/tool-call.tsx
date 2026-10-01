import { ChevronDown, CircleAlert, LoaderCircle, Wrench } from "lucide-react";
import { useLocale } from "@/components/i18n/locale-provider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { stringField, type ToolView } from "@/lib/support/tool-view";

/** What a tool call did, in the interface language (spec §1, item 2). */
export function toolLabel(view: ToolView, t: Messages): string {
  switch (view.name) {
    case "listMyOrders":
      return t.tool.listMyOrders;
    case "getOrder":
      return format(t.tool.getOrder, { id: stringField(view.input, "orderId") ?? "" });
    case "handOff":
      return t.tool.handOff;
    default:
      return format(t.tool.other, { name: view.name });
  }
}

/**
 * A tool's input or output as JSON: data, in English as the tools return it. It wraps, so a long
 * value never widens the page on a phone (ROADMAP S7).
 */
export function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre
      lang="en"
      className="max-h-60 overflow-y-auto rounded-md bg-muted/60 p-2 font-mono text-xs leading-relaxed whitespace-pre-wrap wrap-anywhere"
    >
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

/** A call's input, then its output or error. */
export function ToolCallData({ view }: { view: ToolView }) {
  const { t } = useLocale();
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-medium text-muted-foreground">{t.tool.input}</p>
      <JsonBlock value={view.input ?? {}} />
      {view.state === "done" && (
        <>
          <p className="text-xs font-medium text-muted-foreground">{t.tool.output}</p>
          <JsonBlock value={view.output} />
        </>
      )}
      {view.state === "error" && (
        <>
          <p className="text-xs font-medium text-destructive">{t.tool.error}</p>
          <JsonBlock value={view.error} />
        </>
      )}
    </div>
  );
}

/**
 * A tool chip (spec §1, item 2): what the call did, its state, and on a click its input and
 * output. data-tool and data-tool-state are what the e2e reads.
 */
export function ToolCall({ view }: { view: ToolView }) {
  const { t } = useLocale();
  return (
    <Collapsible
      data-tool={view.name}
      data-tool-state={view.state}
      className="rounded-lg border text-sm"
    >
      <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:min-h-11">
        {view.state === "running" ? (
          <LoaderCircle className="size-4 shrink-0 text-muted-foreground motion-safe:animate-spin" />
        ) : view.state === "error" ? (
          <CircleAlert className="size-4 shrink-0 text-destructive" />
        ) : (
          <Wrench className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 wrap-anywhere">{toolLabel(view, t)}</span>
        {view.state === "running" && (
          <span className="text-xs text-muted-foreground">{t.tool.running}</span>
        )}
        {view.state === "error" && (
          <span className="text-xs text-destructive">{t.tool.failed}</span>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-2.5 py-2">
        <ToolCallData view={view} />
      </CollapsibleContent>
    </Collapsible>
  );
}
