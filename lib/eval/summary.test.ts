import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "@/lib/project";
import type { EvalRun, TicketResult } from "./record";
import { BOOTSTRAP, bootstrapInterval } from "./stats";
import { readmeLines, summarizeResults } from "./summary";
import { EXPECTED_OUTCOME, type Outcome, type TicketKind } from "./tickets";
import type { CitationRecord } from "./transcript";

// The run's summary and the README lines it prints, so no number is typed by hand (template spec
// §7.5; spec §5).

const VERIFIED: CitationRecord = {
  type: "citation",
  n: 1,
  quote: "a quote of words",
  status: "verified",
  article: "returns",
};

function result(
  id: string,
  kind: TicketKind,
  pass: boolean,
  overrides: Partial<TicketResult> = {},
): TicketResult {
  const expected = EXPECTED_OUTCOME[kind];
  return {
    id,
    kind,
    persona: "cus-01",
    message: `Message ${id}`,
    askedAt: "2026-10-05T14:00:00.000Z",
    expected,
    actual: expected,
    pass,
    checks: [],
    otherCustomersOrdersAsked: [],
    reply: `Reply ${id}.`,
    toolCalls: [],
    citations: [],
    messages: [],
    finishReason: "stop",
    usage: { inputTokens: 2000, outputTokens: 100, totalTokens: 2100 },
    latencyMs: 3000,
    ...overrides,
  };
}

/** 8 policy, 6 order, 5 hand-off and 5 refusal tickets: t02, t09 and t15 fail. */
function results(): TicketResult[] {
  const kinds: [TicketKind, number][] = [
    ["policy", 8],
    ["order", 6],
    ["hand-off", 5],
    ["refusal", 5],
  ];
  let n = 0;
  return kinds.flatMap(([kind, count]) =>
    Array.from({ length: count }, () => {
      n += 1;
      const id = `t${String(n).padStart(2, "0")}`;
      return result(id, kind, !["t02", "t09", "t15"].includes(id));
    }),
  );
}

describe("summarizeResults", () => {
  it("counts the tickets handled correctly, the rate and the seeded interval over tickets", () => {
    const summary = summarizeResults(results());
    expect(summary).toMatchObject({ tickets: 24, passed: 21, rate: 21 / 24 });
    const tallies = results().map(({ pass }) => ({ verified: pass ? 1 : 0, total: 1 }));
    expect(summary.interval).toEqual({ ...BOOTSTRAP, ...bootstrapInterval(tallies, BOOTSTRAP) });
    expect(summary.interval.low).toBeLessThan(summary.rate);
    expect(summary.interval.high).toBeGreaterThan(summary.rate);
  });

  it("tallies each kind and lists the failed tickets in order", () => {
    const summary = summarizeResults(results());
    expect(summary.byKind).toEqual({
      policy: { tickets: 8, passed: 7 },
      order: { tickets: 6, passed: 5 },
      "hand-off": { tickets: 5, passed: 4 },
      refusal: { tickets: 5, passed: 5 },
    });
    expect(summary.failed).toEqual(["t02", "t09", "t15"]);
  });

  it("fills the expected × actual outcome matrix, with every cell present", () => {
    const list = results();
    list[1] = { ...list[1], actual: "refused" };
    list[14] = { ...list[14], actual: "order-lookup" };
    const { matrix } = summarizeResults(list);
    const outcomes: Outcome[] = ["answered", "order-lookup", "handed-off", "refused"];
    for (const expected of outcomes) expect(Object.keys(matrix[expected])).toEqual(outcomes);
    expect(matrix.answered).toEqual({
      answered: 7,
      "order-lookup": 0,
      "handed-off": 0,
      refused: 1,
    });
    expect(matrix["handed-off"]).toEqual({
      answered: 0,
      "order-lookup": 1,
      "handed-off": 4,
      refused: 0,
    });
  });

  it("rates the citations of every reply, and sums the tokens it was told", () => {
    const list = results();
    list[0] = { ...list[0], citations: [VERIFIED, VERIFIED] };
    list[1] = { ...list[1], citations: [{ ...VERIFIED, status: "not-found" }] };
    list[2] = { ...list[2], usage: null };
    list[3] = { ...list[3], usage: { inputTokens: 1000, outputTokens: null, totalTokens: 1000 } };
    const summary = summarizeResults(list);
    expect(summary.citations).toEqual({ attempts: 3, verified: 2 });
    expect(summary.tokens).toEqual({
      input: 22 * 2000 + 1000,
      output: 22 * 100,
      total: 22 * 2100 + 1000,
      medianPerTicket: 2100,
    });
  });

  it("takes the median and the longest latency, and counts lookups of other customers' orders", () => {
    const list = results().map((each, i) => ({ ...each, latencyMs: 1000 * (i + 1) }));
    list[19] = { ...list[19], otherCustomersOrdersAsked: ["AO-10326"] };
    list[20] = { ...list[20], otherCustomersOrdersAsked: ["AO-10570", "AO-10570"] };
    const summary = summarizeResults(list);
    expect(summary.latency).toEqual({ medianMs: 12_500, maxMs: 24_000 });
    expect(summary.otherCustomersOrdersAsked).toBe(3);
  });

  it("rejects a run without tickets", () => {
    expect(() => summarizeResults([])).toThrow(RangeError);
  });
});

describe("readmeLines", () => {
  function run(overrides: Partial<EvalRun> = {}): EvalRun {
    const list = results();
    list[0] = { ...list[0], citations: [VERIFIED, VERIFIED, { ...VERIFIED, status: "not-found" }] };
    return {
      date: "2026-10-05T14:00:00.000Z",
      aborted: false,
      abortReason: null,
      mock: false,
      model: "openai/gpt-6-luna",
      commit: { sha: "0123456789abcdef0123456789abcdef01234567", dirty: false },
      ticketSet: {
        path: "measurements/tickets.json",
        sha256: "c".repeat(64),
        frozenOn: "2026-10-01",
        tickets: 24,
      },
      index: {
        path: "content/help-center-index.json",
        model: "openai/text-embedding-3-small",
        corpusHash: "f".repeat(64),
        chunks: 58,
      },
      results: list,
      summary: summarizeResults(list),
      ...overrides,
    };
  }

  it("prints README line 1: the share handled correctly, n and the 95% CI", () => {
    const { title, summary } = {
      title: readmeLines(run(), "measurements/eval-2026-10-05.json").title,
      summary: run().summary!,
    };
    const low = Math.round(summary.interval.low * 100);
    const high = Math.round(summary.interval.high * 100);
    expect(title).toBe(
      `# ${PRODUCT_NAME} — 88% of 24 frozen tickets handled correctly (95% CI ${low}–${high}%)`,
    );
  });

  it("prints How it's measured: the set, the model, the day, the commit, each kind and the failures", () => {
    const { howMeasured } = readmeLines(run(), "measurements/eval-2026-10-05.json");
    expect(howMeasured).toBe(
      "n=24 frozen English tickets (8 policy, 6 order, 5 hand-off, 5 refusal), each asked once " +
        "to openai/gpt-6-luna through the chat's own pipeline on the server and scored by script, " +
        "with no LLM judge, on 2026-10-05 at commit 0123456; handled correctly: policy 7 of 8, " +
        "order 5 of 6, hand-off 4 of 5, refusal 5 of 5 (failed: t02, t09, t15); citations " +
        "verified: 2 of 3; median 3.0 s and 2,100 tokens per ticket. Portuguese is checked by " +
        "hand, not measured · [raw data](measurements/eval-2026-10-05.json)",
    );
  });

  it("names a dirty working tree and a run with no failures", () => {
    const list = results().map((each) => ({ ...each, pass: true }));
    const lines = readmeLines(
      run({
        commit: { sha: "abcdef0123", dirty: true },
        results: list,
        summary: summarizeResults(list),
      }),
      "x.json",
    );
    expect(lines.howMeasured).toContain("at commit abcdef0 with local changes;");
    expect(lines.howMeasured).toContain("refusal 5 of 5; citations");
    expect(lines.title).toContain("100% of 24 frozen tickets handled correctly (95% CI 100–100%)");
  });

  it("refuses an aborted run, which has no summary", () => {
    expect(() => readmeLines(run({ aborted: true, summary: null }), "x.json")).toThrow(/aborted/);
  });
});
