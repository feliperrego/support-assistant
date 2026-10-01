import { Ban, BookOpen, CircleCheck, CircleX, Headset, Package } from "lucide-react";
import type { ComponentType } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import type { Outcome } from "@/lib/eval/tickets";
import { cn } from "@/lib/utils";

const OUTCOME_ICON: Record<Outcome, ComponentType<{ className?: string }>> = {
  answered: BookOpen,
  "order-lookup": Package,
  "handed-off": Headset,
  refused: Ban,
};

/** An outcome chip (spec §1, item 1): Answered, Order lookup, Handed off or Refused. */
export function OutcomeChip({ outcome, className }: { outcome: Outcome; className?: string }) {
  const { t } = useLocale();
  const Icon = OUTCOME_ICON[outcome];
  return (
    <Badge variant="outline" data-outcome={outcome} className={className}>
      <Icon />
      {t.outcome[outcome]}
    </Badge>
  );
}

/** The pass/fail badge of an eval ticket (spec §1, item 1; scored by lib/eval/score.ts). */
export function VerdictBadge({ pass, className }: { pass: boolean; className?: string }) {
  const { t } = useLocale();
  return (
    <Badge
      variant={pass ? "secondary" : "destructive"}
      data-verdict={pass ? "pass" : "fail"}
      className={cn(pass && "bg-emerald-600/10 text-emerald-700", className)}
    >
      {pass ? <CircleCheck /> : <CircleX />}
      {pass ? t.verdict.pass : t.verdict.fail}
    </Badge>
  );
}
