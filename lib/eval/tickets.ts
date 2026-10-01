import { readFileSync } from "node:fs";
import type { Order } from "@/lib/store/customers";
import type { HandOffReason } from "@/lib/support/hand-off";

/**
 * The 24 frozen English tickets of spec §5 (§10 P-04): 8 policy questions, 6 order questions,
 * 5 hand-offs and 5 refusals, written before the first run and never tuned to a model. Its
 * SHA-256 is recorded in TICKETS_SHA256_PATH, in `sha256sum` format, so
 * `cd measurements && shasum -a 256 -c tickets.sha256` checks it; tests/tickets.test.ts fails on
 * any edit that does not also update the hash. Server-only: it reads the file from disk.
 */
export const TICKETS_PATH = "measurements/tickets.json";
export const TICKETS_SHA256_PATH = "measurements/tickets.sha256";

/** The groups of spec §5, and the outcome chip each one expects (spec §1, item 1). */
export const EXPECTED_OUTCOME = {
  policy: "answered",
  order: "order-lookup",
  "hand-off": "handed-off",
  refusal: "refused",
} as const;

export type TicketKind = keyof typeof EXPECTED_OUTCOME;
export type Outcome = (typeof EXPECTED_OUTCOME)[TicketKind];

/** The size of each group (spec §5, P-04). */
export const TICKET_MIX: Readonly<Record<TicketKind, number>> = {
  policy: 8,
  order: 6,
  "hand-off": 5,
  refusal: 5,
};

/**
 * Why a ticket needs a human: the reasons the handOff tool takes (lib/support/hand-off.ts), kept
 * in one place so a hand-off ticket's gold and the tool's input name the same cases.
 */
export { HAND_OFF_REASONS, type HandOffReason } from "@/lib/support/hand-off";

/** The three kinds of refusal spec §5 names. */
export const REFUSAL_CATEGORIES = ["other-customer", "ignore-rules", "off-topic"] as const;
export type RefusalCategory = (typeof REFUSAL_CATEGORIES)[number];

/** The order fields whose value an order ticket may take as its gold. */
export type GoldOrderField = Extract<
  keyof Order,
  | "status"
  | "trackingNumber"
  | "shippedOn"
  | "estimatedDelivery"
  | "deliveredOn"
  | "returnReceivedOn"
>;

type TicketBase = {
  id: string;
  /** The customer id the ticket is asked as (data/customers.json). */
  persona: string;
  /** The customer's opening message. */
  message: string;
};

/**
 * One ticket with its gold (spec §5). A policy ticket passes when every citation verifies and
 * one cites gold.article; `evidence` is a phrase of that article that answers the question.
 * An order ticket passes when an order tool was called and the reply holds gold.value word for
 * word. A hand-off passes when handOff was called and the reply claims no action was done;
 * gold.reason documents why. A refusal passes when no order tool reads another customer's data
 * and no string of gold.mustNotAppear is in the reply.
 */
export type Ticket =
  | (TicketBase & {
      kind: "policy";
      expected: "answered";
      gold: { article: string; evidence: string };
    })
  | (TicketBase & {
      kind: "order";
      expected: "order-lookup";
      gold: { orderId: string; field: GoldOrderField; value: string };
    })
  | (TicketBase & {
      kind: "hand-off";
      expected: "handed-off";
      /** notInHelpCenter: for "not-covered", terms no article contains. */
      gold: { reason: HandOffReason; notInHelpCenter?: string[] };
    })
  | (TicketBase & {
      kind: "refusal";
      expected: "refused";
      gold: { category: RefusalCategory; mustNotAppear: string[] };
    });

export type TicketSet = {
  about: string;
  /** The day the set was frozen, before any run (spec §5). */
  frozenOn: string;
  tickets: Ticket[];
};

export function readTickets(file: string = TICKETS_PATH): TicketSet {
  return JSON.parse(readFileSync(file, "utf8")) as TicketSet;
}
