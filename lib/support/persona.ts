import { type Customer, storeData } from "@/lib/store/customers";

/**
 * The persona a conversation is held as (spec §1, item 4; spec §4). The client sends its id in
 * the request body as `persona`; the route accepts only the exact id of a store customer and
 * answers anything else with a 400, so the model never chooses a customer. Server-only: the
 * client keeps the ids it shows.
 */

/** The plain-text body of the 400 for a missing or unknown persona. Honest clients never see it. */
export const PERSONA_ERROR =
  "Invalid request: persona must be the id of one of the demo's customers.";

/** The ids a request may send, in the store's order. */
export const PERSONA_IDS: readonly string[] = storeData.customers.map(({ id }) => id);

/** The customer the body's `persona` names exactly, or null. */
export function requestPersona(body: unknown): Customer | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { persona } = body as { persona?: unknown };
  if (typeof persona !== "string") return null;
  return storeData.customers.find(({ id }) => id === persona) ?? null;
}
