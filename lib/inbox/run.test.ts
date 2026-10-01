import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MOCK_RUN_PATH } from "@/lib/eval/record";
import { pickRunFile, readShownRun, runLabel } from "./run";

// Which eval run the inbox and the Evals page show (spec §1 items 1 and 6, P-09).
describe("pickRunFile", () => {
  it("shows the mock run while no real run exists", () => {
    expect(pickRunFile([])).toBe(MOCK_RUN_PATH);
    expect(pickRunFile(["eval-mock.json", "tickets.json", "tickets.sha256"])).toBe(MOCK_RUN_PATH);
  });

  it("shows the newest finished real run, never an aborted one", () => {
    expect(
      pickRunFile([
        "eval-mock.json",
        "eval-2026-10-02.json",
        "eval-2026-10-03-101500.aborted.json",
        "eval-2026-09-30.json",
        "ttft-2026-10-04.json",
      ]),
    ).toBe("measurements/eval-2026-10-02.json");
  });

  it("ignores files that only look like a run", () => {
    expect(
      pickRunFile(["eval-2026-10-02.json.bak", "eval-latest.json", "xeval-2026-10-02.json"]),
    ).toBe(MOCK_RUN_PATH);
  });
});

describe("readShownRun", () => {
  // The committed run: the mock until rollout step 3 commits a real one, then that one.
  it("reads the run pickRunFile picks, a finished run with a summary", () => {
    const { file, run } = readShownRun();
    expect(file).toBe(pickRunFile(readdirSync(path.dirname(MOCK_RUN_PATH))));
    expect(run.mock).toBe(file === MOCK_RUN_PATH);
    expect(run.aborted).toBe(false);
    expect(run.summary).not.toBeNull();
    expect(run.results).toHaveLength(24);
  });
});

describe("runLabel", () => {
  it("gives the date, model and short commit the screens label the run with", () => {
    const { run } = readShownRun();
    const label = runLabel(run);
    expect(label).toEqual({
      date: run.date,
      model: run.model,
      commit: run.commit.sha.slice(0, 7),
      dirty: run.commit.dirty,
      mock: run.mock,
    });
    expect(label.commit).toMatch(/^[0-9a-f]{7}$/);
  });
});
