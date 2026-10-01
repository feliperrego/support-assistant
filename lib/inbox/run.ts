import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { type EvalRun, MOCK_RUN_PATH } from "@/lib/eval/record";

/**
 * The eval run the inbox and the Evals page show (spec §1 items 1 and 6, P-09): the newest
 * finished real run, or the mock run while none exists, labelled with its date, model and commit
 * either way. Server-only: it reads measurements/ at build time.
 */

const MEASUREMENTS_DIR = path.dirname(MOCK_RUN_PATH);

/** A finished real run: measurements/eval-YYYY-MM-DD.json (lib/measure/record.ts). */
const REAL_RUN = /^eval-\d{4}-\d{2}-\d{2}\.json$/;

/** The run file to show among the file names of measurements/. Pure. */
export function pickRunFile(files: readonly string[]): string {
  const real = files.filter((file) => REAL_RUN.test(file)).sort();
  const newest = real.at(-1);
  return newest === undefined ? MOCK_RUN_PATH : `${MEASUREMENTS_DIR}/${newest}`;
}

/** The shown run, read from disk; a run without a summary is never shown. */
export function readShownRun(): { file: string; run: EvalRun } {
  const file = pickRunFile(readdirSync(MEASUREMENTS_DIR));
  const run = JSON.parse(readFileSync(file, "utf8")) as EvalRun;
  if (run.aborted || run.summary === null) {
    throw new Error(`${file} is not a finished run: the inbox shows finished runs only.`);
  }
  return { file, run };
}

/** What the screens say about the run: its date (ISO 8601), model, short commit, and mode. */
export type RunLabel = {
  date: string;
  model: string;
  commit: string;
  /** The working tree had changes when the run ran. */
  dirty: boolean;
  /** A mock run: never a measurement (spec §4). */
  mock: boolean;
};

export function runLabel(run: EvalRun): RunLabel {
  return {
    date: run.date,
    model: run.model,
    commit: run.commit.sha.slice(0, 7),
    dirty: run.commit.dirty,
    mock: run.mock,
  };
}
