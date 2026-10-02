import { describe, expect, it } from "vitest";
import type { TicketResult } from "@/lib/eval/record";
import { storeData } from "@/lib/store/customers";
import { readShownRun } from "./run";
import { analysisOf, conversationSummaries, customerCard, inboxData } from "./view";

// What the inbox shows of a recorded run (spec §1 items 1–3): the conversation list, and the
// right panel's Details and Analysis tabs.

const { run } = readShownRun();
const byId = (id: string): TicketResult => run.results.find((result) => result.id === id)!;

describe("conversationSummaries", () => {
  it("lists every ticket in the set's order, with its customer, chips and badge", () => {
    const summaries = conversationSummaries(run.results, storeData.customers);
    expect(summaries.map(({ id }) => id)).toEqual(run.results.map(({ id }) => id));
    expect(summaries[0]).toEqual({
      id: "t01",
      kind: "policy",
      customer: "Liam Walsh",
      message: "If my order comes to $60, will I have to pay for shipping?",
      expected: "answered",
      actual: byId("t01").actual,
      pass: byId("t01").pass,
    });
  });

  it("falls back to the customer id when the run names an unknown customer", () => {
    const [result] = run.results;
    const [summary] = conversationSummaries(
      [{ ...result, persona: "cus-99" }],
      storeData.customers,
    );
    expect(summary.customer).toBe("cus-99");
  });
});

describe("customerCard", () => {
  it("gives the Details tab the customer's name, e-mail and orders, newest first, without items", () => {
    const card = customerCard(storeData.customers[0]);
    expect(card.name).toBe("Maya Chen");
    expect(card.email).toBe("maya.chen@mail.example");
    expect(card.orders.map(({ id }) => id)).toEqual(["AO-10547", "AO-10351"]);
    expect(Object.keys(card.orders[0]).sort()).toEqual(["id", "placedOn", "status", "total"]);
  });
});

describe("analysisOf", () => {
  // The tickets come from the shown run, the mock or the real one: a real answer may call a tool on
  // any ticket, so none is named here.
  it("lists the retrieved passages with their scores and marks the ones the answer cites", () => {
    const result = run.results.find(
      ({ toolCalls, citations }) => toolCalls.length === 0 && citations.length > 0,
    )!;
    expect(result, "the shown run has a cited answer with no tool call").toBeDefined();
    const analysis = analysisOf(result);
    expect(analysis.passages).toHaveLength(5);
    expect(analysis.passages.map(({ number }) => number)).toEqual([1, 2, 3, 4, 5]);
    const cited = new Set(
      result.citations.flatMap((citation) => (citation.type === "citation" ? [citation.n] : [])),
    );
    expect(analysis.passages.map(({ cited: isCited }) => isCited)).toEqual(
      [1, 2, 3, 4, 5].map((n) => cited.has(n)),
    );
    expect(analysis.passages[0].score).toBeGreaterThanOrEqual(analysis.passages[1].score);
    expect(analysis.retrieval?.topScore).toBe(analysis.passages[0].score);
    expect(analysis.toolCalls).toEqual([]);
    expect(analysis.usage).toEqual(result.usage);
    expect(analysis.latencyMs).toBe(result.latencyMs);
  });

  it("lists the tool calls of an order lookup and of a hand-off, with their inputs and outputs", () => {
    const lookup = run.results.find(({ toolCalls }) =>
      toolCalls.some(({ toolName }) => toolName === "getOrder"),
    )!;
    expect(lookup, "the shown run has a getOrder call").toBeDefined();
    expect(analysisOf(lookup).toolCalls.map(({ toolName }) => toolName)).toEqual(
      lookup.toolCalls.map(({ toolName }) => toolName),
    );
    expect(analysisOf(lookup).toolCalls.map(({ toolName }) => toolName)).toContain("getOrder");
    const handedOff = run.results.find(({ actual }) => actual === "handed-off")!;
    const handOff = analysisOf(handedOff).toolCalls.find(({ toolName }) => toolName === "handOff")!;
    expect(handOff, "the shown run has a hand-off").toBeDefined();
    expect(handOff.input).toMatchObject({ reason: expect.any(String) });
    expect(handOff.output).toMatchObject({ handedOff: true });
  });
});

describe("inboxData", () => {
  it("opens the first conversation by default, or the one asked for, with its customer", () => {
    const first = inboxData(run, storeData.customers);
    expect(first?.result.id).toBe(run.results[0].id);
    expect(first?.conversations).toHaveLength(run.results.length);
    const t15 = inboxData(run, storeData.customers, "t15");
    expect(t15?.result).toBe(byId("t15"));
    expect(t15?.customer?.id).toBe(byId("t15").persona);
    expect(t15?.analysis).toEqual(analysisOf(byId("t15")));
  });

  it("has no conversation for an unknown ticket id", () => {
    expect(inboxData(run, storeData.customers, "t99")).toBeNull();
  });
});
