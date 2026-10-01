import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MOCK_RUN_PATH, type EvalRun } from "@/lib/eval/record";
import { scoreTicket } from "@/lib/eval/score";
import { summarizeResults } from "@/lib/eval/summary";
import { readTickets, TICKETS_SHA256_PATH } from "@/lib/eval/tickets";
import { toTranscript } from "@/lib/eval/transcript";
import { readIndexFile } from "@/lib/rag/index-file";

// The committed mock run (spec §5): the inbox shows it until the real run exists (P-09), so it
// must match the frozen tickets, the help-center index, the scorer and the transcript reader of
// this commit. A stale one fails here, or in CI's `pnpm eval --check` when the pipeline's answers
// changed (lib/eval/check.ts): rerun `AI_MOCK=1 pnpm eval` and commit the file.
describe(MOCK_RUN_PATH, () => {
  const run = JSON.parse(readFileSync(MOCK_RUN_PATH, "utf8")) as EvalRun;
  const { tickets } = readTickets();

  it("is a finished mock run of the frozen tickets, against the committed index", () => {
    expect(run).toMatchObject({ mock: true, model: "mock", aborted: false, abortReason: null });
    expect(run.ticketSet.sha256).toBe(readFileSync(TICKETS_SHA256_PATH, "utf8").split(/\s+/)[0]);
    expect(run.index.corpusHash).toBe(readIndexFile().corpusHash);
    expect(run.results.map(({ id }) => id)).toEqual(tickets.map(({ id }) => id));
  });

  it("holds each ticket's transcript as the transcript reader reads its answer", () => {
    for (const result of run.results) {
      const [user, answer] = result.messages;
      expect(user.parts).toEqual([{ type: "text", text: result.message }]);
      const { reply, toolCalls, citations } = result;
      expect(toTranscript(answer)).toEqual({ reply, toolCalls, citations });
    }
  });

  it("holds each ticket's score as the scorer scores it, and the summary of those scores", () => {
    for (const [i, result] of run.results.entries()) {
      const { reply, toolCalls, citations } = result;
      const score = scoreTicket(tickets[i], { reply, toolCalls, citations });
      expect({
        pass: result.pass,
        expected: result.expected,
        actual: result.actual,
        checks: result.checks,
        handOffReason: result.handOffReason,
        otherCustomersOrdersAsked: result.otherCustomersOrdersAsked,
      }).toEqual({ handOffReason: undefined, ...score });
    }
    expect(run.summary).toEqual(summarizeResults(run.results));
  });

  it("shows every outcome chip of the inbox (spec §1, item 1)", () => {
    expect(new Set(run.results.map(({ actual }) => actual))).toEqual(
      new Set(["answered", "order-lookup", "handed-off", "refused"]),
    );
  });
});
