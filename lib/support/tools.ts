import { tool } from "ai";
import { z } from "zod";
import { type Customer, type Order, type OrderItem, storeData } from "@/lib/store/customers";
import { parseStoreDate } from "@/lib/store/dates";
import { HAND_OFF_NEXT, HAND_OFF_REASONS } from "./hand-off";

/**
 * The assistant's tools (spec §4): listMyOrders() and getOrder(orderId), which read only the
 * orders of the persona chosen for the conversation, and handOff(reason, summary). The server
 * scopes the order tools: the customer comes from the tool context the route sets from the
 * validated request (supportToolsContext), never from the model's input, so the model cannot name
 * another customer. lib/support/tools.test.ts pins it. Server-only.
 */

/** What getOrder answers for an order that is not on the customer's account, whoever owns it. */
export const ORDER_NOT_FOUND = "There is no order with this number on this customer's account.";

export type OrderSummary = {
  id: string;
  placedOn: string;
  status: Order["status"];
  items: Omit<OrderItem, "price">[];
  total: number;
};

export type OrderLookup =
  { found: true; order: Order } | { found: false; orderId: string; message: string };

export type HandOffResult = { handedOff: true; reason: string; summary: string; next: string };

function customerById(customerId: string): Customer {
  const customer = storeData.customers.find(({ id }) => id === customerId);
  // The route validates the persona first, so this is a programming error, not a model's.
  if (!customer) throw new Error(`Unknown customer: ${customerId}`);
  return customer;
}

/**
 * An order id as a customer or the model may write it: any case, a leading "#" or "order", a
 * space instead of the hyphen, or the five digits alone. Anything else is only trimmed and
 * upper-cased, and then matches no order.
 */
export function normalizeOrderId(written: string): string {
  const text = written.trim().toUpperCase();
  const match = /^(?:ORDER\s+)?#?\s*(?:AO[\s-]?)?(\d{5})$/.exec(text);
  return match ? `AO-${match[1]}` : text;
}

/** The customer's orders, newest first, as listMyOrders returns them. */
export function listOrders(customerId: string): OrderSummary[] {
  return customerById(customerId)
    .orders.map(({ id, placedOn, status, items, total }) => ({
      id,
      placedOn,
      status,
      items: items.map(({ name, variant, quantity }) =>
        variant === undefined ? { name, quantity } : { name, variant, quantity },
      ),
      total,
    }))
    .sort((a, b) => parseStoreDate(b.placedOn).getTime() - parseStoreDate(a.placedOn).getTime());
}

/**
 * One of the customer's own orders, in full. An order of another customer gets the same answer as
 * an order that does not exist, so the tool never even confirms that it exists.
 */
export function lookUpOrder(customerId: string, orderId: string): OrderLookup {
  const id = normalizeOrderId(orderId);
  const order = customerById(customerId).orders.find((candidate) => candidate.id === id);
  return order ? { found: true, order } : { found: false, orderId: id, message: ORDER_NOT_FOUND };
}

/** The server-side context of the order tools: the persona chosen for the conversation. */
const customerContext = z.object({ customerId: z.string() });

export const supportTools = {
  listMyOrders: tool({
    description:
      "List the orders on the signed-in customer's own account, newest first: id, date placed, status, items and total.",
    inputSchema: z.object({}),
    contextSchema: customerContext,
    execute: async (_input, { context }) => ({ orders: listOrders(context.customerId) }),
  }),
  getOrder: tool({
    description:
      "Get the full details of one order on the signed-in customer's own account: status, items, " +
      "prices, shipping method and the dates, tracking number and refund it has so far.",
    inputSchema: z.object({
      orderId: z.string().describe('The order number, such as "AO-10351".'),
    }),
    contextSchema: customerContext,
    execute: async ({ orderId }, { context }): Promise<OrderLookup> =>
      lookUpOrder(context.customerId, orderId),
  }),
  handOff: tool({
    description:
      "Hand the conversation to a member of the support team, who replies by email. Use it for " +
      "refunds, order changes or cancellations, delivery problems, damaged or defective items and " +
      "warranty claims, and anything the help center does not cover.",
    inputSchema: z.object({
      reason: z.enum(HAND_OFF_REASONS).describe("Why a person is needed."),
      summary: z
        .string()
        .min(1)
        .max(500)
        .describe("A short note for the team: what the customer asked for, with any order number."),
    }),
    execute: async ({ reason, summary }): Promise<HandOffResult> => ({
      handedOff: true,
      reason,
      summary,
      next: HAND_OFF_NEXT,
    }),
  }),
};

export type SupportTools = typeof supportTools;

/** The tool context for one conversation: both order tools read this customer only. */
export function supportToolsContext(customerId: string) {
  return { listMyOrders: { customerId }, getOrder: { customerId } };
}
