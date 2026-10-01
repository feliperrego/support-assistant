import { describe, expect, it } from "vitest";
import { headlineNumbers } from "@/lib/eval/summary";
import { readShownRun } from "@/lib/inbox/run";
import { storeData } from "@/lib/store/customers";
import { evalsData } from "./view";

// The Evals page (spec §1 item 6): the headline with its CI, the outcome matrix, the per-ticket
// table and the run's metadata, all read from the run file (ROADMAP Q11: measured numbers only).
describe("evalsData", () => {
  const { file, run } = readShownRun();
  const data = evalsData(run, file, storeData.customers);

  it("takes the headline and the matrix from the run's summary, never from elsewhere", () => {
    expect(data.headline).toEqual(headlineNumbers(run.summary!));
    expect(data.summary).toBe(run.summary);
  });

  it("has one row per ticket, in the set's order, with its latency and total tokens", () => {
    expect(data.tickets.map(({ id }) => id)).toEqual(run.results.map(({ id }) => id));
    const [row] = data.tickets;
    const [result] = run.results;
    expect(row).toMatchObject({
      id: result.id,
      customer: "Liam Walsh",
      expected: result.expected,
      actual: result.actual,
      pass: result.pass,
      latencyMs: result.latencyMs,
      totalTokens: result.usage?.totalTokens ?? null,
    });
  });

  it("carries the run's file and metadata for the Run details block", () => {
    expect(data.file).toBe(file);
    expect(data.ticketSet).toEqual(run.ticketSet);
    expect(data.index).toEqual(run.index);
    expect(data.run.commit).toBe(run.commit.sha.slice(0, 7));
  });
});
