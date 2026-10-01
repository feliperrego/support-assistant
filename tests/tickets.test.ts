import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_USER_CHARS } from "@/lib/chat/config";
import {
  EXPECTED_OUTCOME,
  HAND_OFF_REASONS,
  REFUSAL_CATEGORIES,
  TICKET_MIX,
  TICKETS_PATH,
  TICKETS_SHA256_PATH,
  readTickets,
  type Ticket,
  type TicketKind,
} from "@/lib/eval/tickets";
import { readHelpCenter } from "@/lib/help-center/articles";
import { LOCALES } from "@/lib/i18n/locale";
import { messages } from "@/lib/i18n/messages";
import { storeData } from "@/lib/store/customers";

// The frozen tickets of spec §5 (P-04): their mix, and gold that exists in the help center and
// in data/customers.json. Written before any run; the hash below makes every edit visible.
const set = readTickets();
const { tickets } = set;
const articles = readHelpCenter();
const helpCenterText = articles.map(({ content }) => content.toLowerCase()).join("\n");
const customers = new Map(storeData.customers.map((customer) => [customer.id, customer]));

/** Text compared case-insensitively, every dash a hyphen and whitespace collapsed. */
function folded(text: string): string {
  return text
    .replace(/\p{Pd}/gu, "-")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function ofKind<K extends TicketKind>(kind: K): Extract<Ticket, { kind: K }>[] {
  return tickets.filter((ticket): ticket is Extract<Ticket, { kind: K }> => ticket.kind === kind);
}

function persona(ticket: Ticket) {
  const customer = customers.get(ticket.persona);
  if (!customer) throw new Error(`${ticket.id}: no customer ${ticket.persona}`);
  return customer;
}

describe(TICKETS_PATH, () => {
  it("is the file whose SHA-256 is recorded, so no edit goes unnoticed", () => {
    const hash = createHash("sha256").update(readFileSync(TICKETS_PATH)).digest("hex");
    expect(readFileSync(TICKETS_SHA256_PATH, "utf8")).toBe(
      `${hash}  ${path.basename(TICKETS_PATH)}\n`,
    );
  });

  it("records the day it was frozen, before any run", () => {
    expect(set.frozenOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(set.about).toContain("frozen");
  });

  it("holds 24 tickets numbered t01 to t24, in the mix of spec §5", () => {
    expect(tickets.map(({ id }) => id)).toEqual(
      Array.from({ length: 24 }, (_, i) => `t${String(i + 1).padStart(2, "0")}`),
    );
    for (const kind of Object.keys(TICKET_MIX) as TicketKind[]) {
      expect(ofKind(kind), kind).toHaveLength(TICKET_MIX[kind]);
    }
  });

  it("expects the outcome of each ticket's group (spec §1)", () => {
    for (const { id, kind, expected } of tickets) {
      expect(expected, id).toBe(EXPECTED_OUTCOME[kind]);
    }
  });

  it("asks every ticket as one of the customers, and each customer at least once", () => {
    for (const ticket of tickets) persona(ticket);
    expect(new Set(tickets.map((ticket) => ticket.persona))).toEqual(new Set(customers.keys()));
  });

  it("opens each ticket with its own message, short enough for the composer", () => {
    const keys = tickets.map(({ message }) => folded(message.trim()));
    expect(new Set(keys).size).toBe(keys.length);
    for (const { id, message } of tickets) {
      expect(message.trim(), id).not.toBe("");
      expect(message.length, id).toBeLessThanOrEqual(MAX_USER_CHARS);
    }
  });

  it("repeats no suggested prompt, so the demo never shows a ticket's answer in advance", () => {
    const prompts = new Set(LOCALES.flatMap((locale) => messages[locale].prompts).map(folded));
    for (const { id, message } of tickets) expect(prompts.has(folded(message)), id).toBe(false);
  });
});

describe("the policy tickets' gold", () => {
  it.each(ofKind("policy").map((ticket) => [ticket.id, ticket] as const))(
    "%s names an article that holds its evidence",
    (_, { gold }) => {
      const article = articles.find(({ id }) => id === gold.article);
      expect(article, gold.article).toBeDefined();
      expect(folded(article!.content)).toContain(folded(gold.evidence));
    },
  );

  it("spreads over 8 different articles", () => {
    expect(new Set(ofKind("policy").map(({ gold }) => gold.article)).size).toBe(8);
  });
});

describe("the order tickets' gold", () => {
  it.each(ofKind("order").map((ticket) => [ticket.id, ticket] as const))(
    "%s is the exact value of one of its persona's orders, and not in the message",
    (_, ticket) => {
      const { orderId, field, value } = ticket.gold;
      const own = persona(ticket).orders;
      expect(own.find(({ id }) => id === orderId)?.[field], orderId).toBe(value);
      // The value picks one order, so only a lookup of that order can give it.
      expect(own.filter((order) => order[field] === value).map(({ id }) => id)).toEqual([orderId]);
      expect(folded(ticket.message)).not.toContain(folded(value));
    },
  );

  it("asks for statuses and dates, the values spec §5 names", () => {
    const fields = new Set(ofKind("order").map(({ gold }) => gold.field));
    expect(fields.has("status")).toBe(true);
    expect([...fields].some((field) => field.endsWith("On") || field === "estimatedDelivery")).toBe(
      true,
    );
  });
});

describe("the hand-off tickets' gold", () => {
  it.each(ofKind("hand-off").map((ticket) => [ticket.id, ticket] as const))(
    "%s gives a reason the assistant hands off",
    (_, { gold }) => {
      expect(HAND_OFF_REASONS).toContain(gold.reason);
      if (gold.reason === "not-covered") {
        // Something the help center never mentions, as spec §4 hands off.
        expect(gold.notInHelpCenter?.length).toBeGreaterThan(0);
        for (const term of gold.notInHelpCenter ?? []) {
          expect(helpCenterText).not.toContain(term.toLowerCase());
        }
      } else {
        expect(gold.notInHelpCenter).toBeUndefined();
      }
    },
  );
});

describe("the refusal tickets' gold", () => {
  it("covers the three kinds of refusal spec §5 names", () => {
    expect(new Set(ofKind("refusal").map(({ gold }) => gold.category))).toEqual(
      new Set(REFUSAL_CATEGORIES),
    );
  });

  it.each(ofKind("refusal").map((ticket) => [ticket.id, ticket] as const))(
    "%s lists strings that only a wrong reply could hold",
    (_, ticket) => {
      const { category, mustNotAppear } = ticket.gold;
      expect(mustNotAppear.length).toBeGreaterThan(0);
      const own = JSON.stringify(persona(ticket)).toLowerCase();
      const others = storeData.customers
        .filter(({ id }) => id !== ticket.persona)
        .map((customer) => JSON.stringify(customer).toLowerCase());
      for (const text of mustNotAppear.map((item) => item.toLowerCase())) {
        // Not in the message, nor in the help center a correct answer may quote.
        expect(folded(ticket.message)).not.toContain(folded(text));
        expect(helpCenterText).not.toContain(text);
        expect(own, text).not.toContain(text);
        if (category === "off-topic") {
          expect(
            others.some((other) => other.includes(text)),
            text,
          ).toBe(false);
        } else {
          // Another customer's data, which the reply must not leak.
          expect(
            others.some((other) => other.includes(text)),
            text,
          ).toBe(true);
        }
      }
    },
  );
});
