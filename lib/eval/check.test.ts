import { describe, expect, it } from "vitest";
import { mockRunChanges } from "./check";
import type { EvalRun, TicketResult } from "./record";
import { summarizeResults } from "./summary";
import type { CitationRecord } from "./transcript";

// The mock eval in CI (spec §5; ROADMAP S4): the mock's answers are known, so a fresh mock run
// must give the committed mock run's transcripts and verdicts. Only times may differ.

const CITATION: CitationRecord = {
  type: "citation",
  n: 1,
  quote: "within 30 days of delivery",
  status: "verified",
  article: "returns",
};

function result(id: string, overrides: Partial<TicketResult> = {}): TicketResult {
  return {
    id,
    kind: "policy",
    persona: "cus-01",
    message: `Message ${id}`,
    askedAt: "2026-10-01T15:00:00.000Z",
    expected: "answered",
    actual: "answered",
    pass: true,
    checks: [
      { id: "has-citation", ok: true },
      { id: "all-citations-verified", ok: true },
      { id: "cites-gold-article", ok: true },
    ],
    otherCustomersOrdersAsked: [],
    reply: `Reply ${id} [1: "within 30 days of delivery"].`,
    toolCalls: [],
    citations: [CITATION],
    messages: [],
    finishReason: "stop",
    usage: { inputTokens: 20, outputTokens: 8, totalTokens: 28 },
    latencyMs: 30,
    ...overrides,
  };
}

function run(results: TicketResult[], overrides: Partial<EvalRun> = {}): EvalRun {
  return {
    date: "2026-10-01T15:00:00.000Z",
    aborted: false,
    abortReason: null,
    mock: true,
    model: "mock",
    commit: { sha: "90589ab0000000000000000000000000000000000", dirty: false },
    ticketSet: {
      path: "measurements/tickets.json",
      sha256: "c24b",
      frozenOn: "2026-10-01",
      tickets: results.length,
    },
    index: {
      path: "content/help-center-index.json",
      model: "mock",
      corpusHash: "abcd",
      chunks: 58,
    },
    results,
    summary: summarizeResults(results),
    ...overrides,
  };
}

const committed = run([result("t01"), result("t02")]);

describe("mockRunChanges", () => {
  it("finds no change when only the date, the commit and the times differ", () => {
    const fresh = run(
      [
        result("t01", { askedAt: "2026-10-02T09:00:00.000Z", latencyMs: 12 }),
        result("t02", { askedAt: "2026-10-02T09:00:01.000Z", latencyMs: 41 }),
      ],
      { date: "2026-10-02T09:00:00.000Z", commit: { sha: "1234567", dirty: true } },
    );
    expect(mockRunChanges(committed, fresh)).toEqual([]);
  });

  it("ignores a field the fresh run holds as undefined, as the written JSON drops it", () => {
    const fresh = run([result("t01", { handOffReason: undefined }), result("t02")]);
    expect(mockRunChanges(committed, fresh)).toEqual([]);
  });

  it("names a ticket whose verdict flipped, either way", () => {
    const failed = run([result("t01", { pass: false }), result("t02")]);
    expect(mockRunChanges(committed, failed)).toEqual(["t01: pass → FAIL"]);
    expect(mockRunChanges(failed, committed)).toEqual(["t01: FAIL → pass"]);
  });

  it("names a ticket whose outcome, checks or hand-off reason changed", () => {
    const fresh = run([
      result("t01", { actual: "refused" }),
      result("t02", {
        checks: [{ id: "has-citation", ok: false }],
        handOffReason: "refund",
        otherCustomersOrdersAsked: ["AO-10301"],
      }),
    ]);
    expect(mockRunChanges(committed, fresh)).toEqual([
      "t01: outcome answered → refused",
      "t02: the checks differ",
      "t02: the hand-off reason differs",
      "t02: the other customers' orders asked differ",
    ]);
  });

  it("names a ticket whose transcript changed: the reply, the tool calls or the citations", () => {
    const fresh = run([
      result("t01", { reply: "Another reply." }),
      result("t02", {
        toolCalls: [{ toolCallId: "call-1", toolName: "listMyOrders", input: {}, output: [] }],
        citations: [{ ...CITATION, status: "not-found" }],
      }),
    ]);
    expect(mockRunChanges(committed, fresh)).toEqual([
      "t01: the reply differs",
      "t02: the tool calls differ",
      "t02: the citations differ",
    ]);
  });

  it("reports a different ticket list instead of comparing tickets", () => {
    const fresh = run([result("t01"), result("t03")]);
    expect(mockRunChanges(committed, fresh)).toEqual(["the tickets differ: t01, t02 → t01, t03"]);
  });

  it("reports a different ticket set, index or mode", () => {
    const fresh = run([result("t01"), result("t02")], {
      mock: false,
      ticketSet: { ...committed.ticketSet, sha256: "ffff" },
      index: { ...committed.index, corpusHash: "eeee" },
    });
    expect(mockRunChanges(committed, fresh)).toEqual([
      "this run is not a mock run",
      "the frozen tickets' SHA-256 differs",
      "the index's corpus hash differs",
    ]);
    expect(mockRunChanges({ ...committed, mock: false }, committed)).toEqual([
      "the committed run is not a mock run",
    ]);
  });
});
