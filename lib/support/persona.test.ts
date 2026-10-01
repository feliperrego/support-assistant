import { describe, expect, it } from "vitest";
import { storeData } from "@/lib/store/customers";
import { PERSONA_IDS, personaOptions, requestPersona } from "./persona";

// The persona chosen for the conversation travels in the request body and is validated against
// the store's customers (spec §4): only an exact customer id selects one.
describe("requestPersona", () => {
  it("lists every customer of the store as a persona", () => {
    expect(PERSONA_IDS).toEqual(storeData.customers.map(({ id }) => id));
  });

  it.each(storeData.customers.map((customer) => [customer.id, customer] as const))(
    "selects %s by its exact id",
    (id, customer) => {
      expect(requestPersona({ messages: [], persona: id })).toBe(customer);
    },
  );

  it.each([
    ["no persona", {}],
    ["an unknown id", { persona: "cus-99" }],
    ["another case", { persona: "CUS-01" }],
    ["padding", { persona: " cus-01" }],
    ["a name", { persona: "Maya Chen" }],
    ["an e-mail", { persona: "maya.chen@mail.example" }],
    ["a number", { persona: 1 }],
    ["an object", { persona: { id: "cus-01" } }],
  ])("selects nothing for %s", (_, body) => {
    expect(requestPersona(body)).toBeNull();
  });

  it.each([null, undefined, "cus-01", ["cus-01"]])("selects nothing for the body %j", (body) => {
    expect(requestPersona(body)).toBeNull();
  });
});

// The persona picker of "Try as a customer" (spec §1 item 4, P-05): who the visitor can be, with
// the order ids and statuses they can ask about, and nothing else of the customer.
describe("personaOptions", () => {
  it("gives each customer's id, name and orders, newest first, as id and status only", () => {
    const options = personaOptions();
    expect(options.map(({ id }) => id)).toEqual(PERSONA_IDS);
    expect(options[0]).toEqual({
      id: "cus-01",
      name: "Maya Chen",
      orders: [
        { id: "AO-10547", status: "shipped" },
        { id: "AO-10351", status: "delivered" },
      ],
    });
    for (const option of options) {
      expect(Object.keys(option).sort()).toEqual(["id", "name", "orders"]);
    }
  });
});
