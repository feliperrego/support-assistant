/**
 * The store's dates are written as a customer reads them, "September 22, 2026", because an order
 * ticket passes only when the reply holds its gold date word for word (spec §5). Pure and
 * client-safe.
 */

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const STORE_DATE = new RegExp(`^(${MONTHS.join("|")}) ([1-9]|[12][0-9]|3[01]), ([0-9]{4})$`);

/** Writes a Date's UTC day as a store date. */
export function formatStoreDate(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** Reads "September 22, 2026" as UTC midnight; throws a RangeError on any other text. */
export function parseStoreDate(text: string): Date {
  const match = STORE_DATE.exec(text);
  if (!match) throw new RangeError(`Not a store date ("September 22, 2026"): ${text}`);
  const month = MONTHS.indexOf(match[1] as (typeof MONTHS)[number]);
  const date = new Date(Date.UTC(Number(match[3]), month, Number(match[2])));
  // Date.UTC rolls "September 31" over to October 1; the round trip catches it.
  if (formatStoreDate(date) !== text) throw new RangeError(`No such day: ${text}`);
  return date;
}
