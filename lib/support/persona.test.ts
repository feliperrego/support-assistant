import { describe, expect, it } from "vitest";
import { storeData } from "@/lib/store/customers";
import { PERSONA_IDS, requestPersona } from "./persona";

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
