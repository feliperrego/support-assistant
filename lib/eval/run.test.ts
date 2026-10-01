import { MockLanguageModelV4 } from "ai/test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createScenarioMockModel } from "@/lib/ai/mock";
import { resetMockScenarios } from "@/lib/ai/mock-scenarios";
import { loadIndex, readIndexFile } from "@/lib/rag/index-file";
import { createRetriever } from "@/lib/rag/retrieve";
import { storeData } from "@/lib/store/customers";
import type { TicketResult } from "./record";
import { runEval, runTicket } from "./run";
import { readTickets } from "./tickets";

// The eval runs the chat's own pipeline on the server, no browser (spec §5, S4). In mock mode it
// is free, so it runs here on all 24 frozen tickets.

const FAST = { initialDelayInMs: 0, chunkDelayInMs: 0 };
const retriever = createRetriever(loadIndex(readIndexFile(), { mock: true }));
const { tickets } = readTickets();

beforeEach(() => {
  resetMockScenarios();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("runEval with the mock model", () => {
  // One run of the 24 tickets, shared by the tests below.
  let results: TicketResult[];
  let abortReason: string | null;
  beforeAll(async () => {
    resetMockScenarios();
    ({ results, abortReason } = await runEval({
      tickets,
      model: createScenarioMockModel(FAST),
      retriever,
    }));
  }, 60_000);

  it("asks every frozen ticket once, as its persona, and scores it", () => {
    expect(abortReason).toBeNull();
    expect(results.map(({ id }) => id)).toEqual(tickets.map(({ id }) => id));
    for (const [i, result] of results.entries()) {
      const ticket = tickets[i];
      expect(result).toMatchObject({
        kind: ticket.kind,
        persona: ticket.persona,
        message: ticket.message,
        expected: ticket.expected,
        finishReason: "stop",
      });
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.pass).toBe(result.checks.every(({ ok }) => ok));
      const [user, answer] = result.messages;
      expect(user).toEqual({
        id: `${ticket.id}-user`,
        role: "user",
        parts: [{ type: "text", text: ticket.message }],
      });
      expect(answer.role).toBe("assistant");
      expect(answer.parts.some((part) => part.type === "data-sources")).toBe(true);
      expect(answer.metadata?.retrieval.topScore).toEqual(expect.any(Number));
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  // The mock fixture the inbox shows until the real run exists (spec §1, P-09) needs every chip.
  it("produces each of the four outcomes, with the order tools scoped to the persona", () => {
    expect(new Set(results.map(({ actual }) => actual))).toEqual(
      new Set(["answered", "order-lookup", "handed-off", "refused"]),
    );
    for (const result of results) {
      const own = new Set(
        storeData.customers.find(({ id }) => id === result.persona)!.orders.map(({ id }) => id),
      );
      for (const call of result.toolCalls.filter(({ toolName }) => toolName === "getOrder")) {
        const output = call.output as { found: boolean; order?: { id: string } };
        if (output.found) expect(own.has(output.order!.id)).toBe(true);
      }
    }
  });

  it("stops at the first answer that fails, and says why", async () => {
    const failing = new MockLanguageModelV4({
      doStream: async () => {
        throw new Error("Gateway said no");
      },
    });

    const stopped = await runEval({ tickets, model: failing, retriever });

    expect(stopped.results).toEqual([]);
    expect(stopped.abortReason).toBe(
      `the answer to ${tickets[0].id} failed: ` +
        "The model could not finish this response. Please try again.",
    );
  });
});

describe("runTicket", () => {
  it("throws for a ticket whose persona the store does not have", async () => {
    await expect(
      runTicket({
        ticket: { ...tickets[0], persona: "cus-99" },
        model: createScenarioMockModel(FAST),
        retriever,
      }),
    ).rejects.toThrow(/cus-99/);
  });
});
