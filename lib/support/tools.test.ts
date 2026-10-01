import { asSchema, type ToolExecutionOptions } from "ai";
import { describe, expect, it } from "vitest";
import { HAND_OFF_REASONS } from "@/lib/support/hand-off";
import { storeData, type Customer } from "@/lib/store/customers";
import { parseStoreDate } from "@/lib/store/dates";
import {
  listOrders,
  lookUpOrder,
  normalizeOrderId,
  ORDER_NOT_FOUND,
  supportTools,
  supportToolsContext,
} from "./tools";

// Tool scoping (spec §4, §6): the server scopes the order tools to the persona chosen for the
// conversation. The model passes no customer, so no input can reach another customer's orders.

const customers = storeData.customers;
const allOrders = customers.flatMap((customer) =>
  customer.orders.map((order) => ({ owner: customer, order })),
);

/** Every string that identifies another customer or one of their orders. */
function othersData(customer: Customer): string[] {
  return customers
    .filter((other) => other.id !== customer.id)
    .flatMap((other) => [
      other.name,
      other.email,
      ...other.orders.flatMap((order) => [order.id, order.trackingNumber ?? order.id]),
    ]);
}

function options(customerId: string): ToolExecutionOptions<{ customerId: string }> {
  return { toolCallId: "call-1", messages: [], context: { customerId } };
}

describe("lookUpOrder", () => {
  it.each(customers.map((customer) => [customer.id, customer] as const))(
    "lets %s read each of its own orders and none of anyone else's",
    (id, customer) => {
      for (const { owner, order } of allOrders) {
        const result = lookUpOrder(id, order.id);
        if (owner.id === customer.id) {
          expect(result).toEqual({ found: true, order });
        } else {
          expect(result).toEqual({ found: false, orderId: order.id, message: ORDER_NOT_FOUND });
        }
      }
    },
  );

  it("answers another customer's order exactly as an order that does not exist", () => {
    const [maya, daniel] = customers;
    const others = lookUpOrder(maya.id, daniel.orders[0].id);
    const missing = lookUpOrder(maya.id, "AO-99999");
    expect({ ...others, orderId: "x" }).toEqual({ ...missing, orderId: "x" });
  });

  it("reads the id as a customer may write it", () => {
    const [{ id, orders }] = customers;
    const order = orders[0];
    const digits = order.id.slice(3);
    for (const written of [order.id.toLowerCase(), ` #${order.id} `, digits, `order ${order.id}`]) {
      expect(lookUpOrder(id, written)).toEqual({ found: true, order });
    }
  });

  it("throws for a customer the store does not have", () => {
    expect(() => lookUpOrder("cus-99", allOrders[0].order.id)).toThrow(/Unknown customer/);
  });
});

describe("normalizeOrderId", () => {
  it.each([
    ["AO-10583", "AO-10583"],
    ["ao-10583", "AO-10583"],
    ["#AO-10583", "AO-10583"],
    ["  AO-10583\n", "AO-10583"],
    ["10583", "AO-10583"],
    ["order AO-10583", "AO-10583"],
    ["AO 10583", "AO-10583"],
    ["the jacket order", "THE JACKET ORDER"],
  ])("reads %j as %j", (written, id) => {
    expect(normalizeOrderId(written)).toBe(id);
  });
});

describe("listOrders", () => {
  it.each(customers.map((customer) => [customer.id, customer] as const))(
    "lists exactly the orders of %s, newest first, with nothing of another customer",
    (id, customer) => {
      const listed = listOrders(id);
      expect(listed.map((order) => order.id).sort()).toEqual(
        customer.orders.map((order) => order.id).sort(),
      );
      const placed = listed.map((order) => parseStoreDate(order.placedOn).getTime());
      expect(placed).toEqual([...placed].sort((a, b) => b - a));
      const json = JSON.stringify(listed);
      for (const value of othersData(customer)) expect(json).not.toContain(value);
    },
  );

  it("summarizes each order: id, date placed, status, items and total", () => {
    const [summary] = listOrders("cus-02").filter((order) => order.id === "AO-10583");
    expect(summary).toEqual({
      id: "AO-10583",
      placedOn: "September 30, 2026",
      status: "processing",
      items: [{ name: "Acme Loft Insulated Jacket", variant: "Men's M, Black", quantity: 1 }],
      total: 214,
    });
  });

  it("throws for a customer the store does not have", () => {
    expect(() => listOrders("cus-99")).toThrow(/Unknown customer/);
  });
});

describe("supportTools", () => {
  it("offers exactly listMyOrders, getOrder and handOff", () => {
    expect(Object.keys(supportTools).sort()).toEqual(["getOrder", "handOff", "listMyOrders"]);
  });

  // The model fills only the input schema; the customer comes from the server's context.
  it("lets the model name an order id and nothing else: no customer, e-mail or name", async () => {
    const inputs = await Promise.all(
      (["listMyOrders", "getOrder"] as const).map(async (name) => {
        const schema = await asSchema(supportTools[name].inputSchema).jsonSchema;
        return [name, Object.keys(schema.properties ?? {})];
      }),
    );
    expect(Object.fromEntries(inputs)).toEqual({ listMyOrders: [], getOrder: ["orderId"] });
  });

  it("takes the customer from the server's context, for both order tools", () => {
    expect(supportToolsContext("cus-03")).toEqual({
      listMyOrders: { customerId: "cus-03" },
      getOrder: { customerId: "cus-03" },
    });
  });

  it("runs listMyOrders and getOrder for the context's customer only", async () => {
    const { listMyOrders, getOrder } = supportTools;
    const daniel = customers[1];
    expect(await listMyOrders.execute!({}, options(daniel.id))).toEqual({
      orders: listOrders(daniel.id),
    });
    const own = daniel.orders[0];
    expect(await getOrder.execute!({ orderId: own.id }, options(daniel.id))).toEqual({
      found: true,
      order: own,
    });
    const maya = customers[0].orders[0];
    expect(await getOrder.execute!({ orderId: maya.id }, options(daniel.id))).toEqual({
      found: false,
      orderId: maya.id,
      message: ORDER_NOT_FOUND,
    });
  });

  it("hands off with one of the reasons and a summary, and says a person will reply", async () => {
    const schema = await asSchema(supportTools.handOff.inputSchema).jsonSchema;
    expect(schema.required).toEqual(["reason", "summary"]);
    expect(schema.properties?.reason).toMatchObject({ enum: [...HAND_OFF_REASONS] });
    const output = await supportTools.handOff.execute!(
      { reason: "refund", summary: "Wants a refund for a jacket that does not fit." },
      { toolCallId: "call-2", messages: [], context: undefined as never },
    );
    expect(output).toEqual({
      handedOff: true,
      reason: "refund",
      summary: "Wants a refund for a jacket that does not fit.",
      next: "A member of the support team replies by email within 1 business day.",
    });
  });
});
