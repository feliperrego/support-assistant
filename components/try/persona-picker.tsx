"use client";

import { type ReactNode, useId } from "react";
import { useLocale } from "@/components/i18n/locale-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PersonaOption } from "@/lib/support/persona";

type PersonaPickerProps = {
  personas: readonly PersonaOption[];
  value: string;
  onChange: (id: string) => void;
  leading?: ReactNode;
};

/**
 * Who the visitor chats as (spec §1 item 4, P-05): one of the store's fictional customers, with
 * the orders they can ask about. The route scopes the order tools to this customer (spec §4).
 */
export function PersonaPicker({ personas, value, onChange, leading }: PersonaPickerProps) {
  const { t } = useLocale();
  const labelId = useId();
  const hintId = useId();
  const items = personas.map(({ id, name }) => ({ value: id, label: name }));
  const current = personas.find(({ id }) => id === value) ?? personas[0];

  return (
    <div
      data-testid="persona-picker"
      className="flex shrink-0 flex-col gap-1.5 border-b px-4 py-2 text-sm"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {leading}
        {/* The label stays next to the select when the row wraps on a phone. */}
        <span className="flex items-center gap-2">
          <span id={labelId} className="text-muted-foreground">
            {t.persona.label}
          </span>
          <Select
            items={items}
            value={value}
            onValueChange={(next) => {
              if (typeof next === "string") onChange(next);
            }}
          >
            <SelectTrigger
              aria-labelledby={labelId}
              aria-describedby={hintId}
              className="min-w-40 pointer-coarse:h-11"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {personas.map(({ id, name }) => (
                <SelectItem key={id} value={id} className="pointer-coarse:min-h-11">
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {t.persona.orders}
        {": "}
        {current.orders.map((order, i) => (
          <span key={order.id}>
            {i > 0 && " · "}
            <span className="font-mono">{order.id}</span> {t.orderStatus[order.status]}
          </span>
        ))}
      </p>
      <p id={hintId} className="text-xs text-muted-foreground">
        {t.persona.hint}
      </p>
    </div>
  );
}
