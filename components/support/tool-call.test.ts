import { describe, expect, it } from "vitest";
import { LOCALES, type Locale } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import type { ToolView } from "@/lib/support/tool-view";
import { toolLabel } from "./tool-call";

// A tool chip's label names the call and never says what the call did (spec §7, E2; the
// template's W-P22): the chip shows it while the call runs, and adds the call's state after it
// ("Working", "The tool failed").

const STATES: readonly ToolView["state"][] = ["running", "done", "error"];

/** A call of each of P1's tools (lib/support/tools.ts), then one of a tool the dictionary lacks. */
const CALLS: readonly { name: string; input: unknown }[] = [
  { name: "listMyOrders", input: {} },
  { name: "getOrder", input: { orderId: "AO-10589" } },
  { name: "handOff", input: { reason: "refund", summary: "Refund request." } },
  { name: "checkStock", input: {} },
];

/** The approved labels of CALLS, as literals, so a rewording fails here. */
const LABELS: Record<Locale, readonly string[]> = {
  en: ["Customer's orders", "Order lookup: AO-10589", "Hand-off to the team", "Tool: checkStock"],
  "pt-BR": [
    "Pedidos do cliente",
    "Consulta do pedido AO-10589",
    "Encaminhamento à equipe",
    "Ferramenta: checkStock",
  ],
};

const view = (name: string, input: unknown, state: ToolView["state"]): ToolView => ({
  id: "call-1",
  name,
  input,
  state,
});

/**
 * A word in a past tense: English's regular past (-ed) and Portuguese's preterite (-ou, -eu, -iu;
 * -aram, -eram, -iram), the forms the earlier labels took ("Looked up", "Handed off", "Called",
 * "Consultou", "Encaminhou", "Chamou").
 */
const PAST_TENSE: Record<Locale, RegExp> = {
  en: /ed$/i,
  "pt-BR": /(?:ou|eu|iu|aram|eram|iram)$/i,
};

describe("toolLabel", () => {
  it.each(LOCALES.flatMap((locale) => STATES.map((state) => [locale, state] as const)))(
    "names each call in %s, the same way when it is %s",
    (locale, state) => {
      const labels = CALLS.map(({ name, input }) =>
        toolLabel(view(name, input, state), messages[locale]),
      );
      expect(labels).toEqual(LABELS[locale]);
    },
  );

  // While the input streams, the order id may not be there yet.
  it.each([undefined, {}, { orderId: "" }, { orderId: " " }])(
    "names an order lookup whose input is %j with no id, not an empty one",
    (input) => {
      expect(toolLabel(view("getOrder", input, "running"), messages.en)).toBe("Order lookup");
      expect(toolLabel(view("getOrder", input, "running"), messages["pt-BR"])).toBe(
        "Consulta de pedido",
      );
    },
  );

  it.each(LOCALES)("never reads in the past tense on a running chip in %s", (locale) => {
    const t = messages[locale];
    for (const { name, input } of [...CALLS, { name: "getOrder", input: {} }]) {
      // What the running chip shows: the label, then the state's word.
      const chip = `${toolLabel(view(name, input, "running"), t)} ${t.tool.running}`;
      const past = chip.split(/[^\p{L}]+/u).filter((word) => PAST_TENSE[locale].test(word));
      expect(past, chip).toEqual([]);
    }
  });
});
