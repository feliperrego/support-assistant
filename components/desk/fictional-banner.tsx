"use client";

import { Info } from "lucide-react";
import { useLocale } from "@/components/i18n/locale-provider";

/**
 * The notice that the store, its customers and its orders are fictional (spec §1 item 1, §3),
 * on every page: the desk and /try.
 */
export function FictionalBanner() {
  const { t } = useLocale();
  return (
    <p
      role="note"
      data-testid="fictional-banner"
      className="flex shrink-0 items-start gap-2 border-b bg-amber-50 px-4 py-1.5 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <Info className="mt-px size-3.5 shrink-0" />
      <span>{t.banner}</span>
    </p>
  );
}
