import { parseStoreDate } from "@/lib/store/dates";
import type { Locale } from "./locale";

/**
 * How the screens write dates, prices and numbers in the interface language (spec §1, P-11).
 * Data keeps its own form (the store's dates stay "September 22, 2026" in the JSON, lib/store/
 * dates.ts); only what a screen shows is formatted here. Pure and client-safe.
 */

const DAY: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
};

/** An ISO 8601 instant's UTC day, such as "Oct 1, 2026" or "1 de out. de 2026". */
export function formatDay(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, DAY).format(new Date(iso));
}

/** An ISO 8601 instant as day and time, in UTC, with the zone named. */
export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    ...DAY,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

/** A store date ("September 22, 2026") in the interface language. */
export function formatStoreDay(storeDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, DAY).format(parseStoreDate(storeDate));
}

/** A price in US dollars, the store's currency (spec §3). */
export function formatMoney(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(amount);
}

/** A number with the locale's separators, rounded to `digits` decimals. */
export function formatNumber(value: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Milliseconds as seconds with one decimal. */
export function formatSeconds(ms: number, locale: Locale): string {
  return formatNumber(ms / 1000, locale, 1);
}
