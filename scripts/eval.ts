/**
 * The eval of spec §5 (P-08, P-09): asks the 24 frozen tickets once each through the chat's own
 * pipeline on the server, scores them by script, writes every transcript and score, and prints
 * README line 1 and the first line of "How it's measured" (template spec §7.5).
 *
 * Mock mode, zero cost: AI_MOCK=1 pnpm eval
 *   It rewrites measurements/eval-mock.json, the inbox's stand-in until the real run exists.
 *   Its README lines only show the format: never paste them into the README.
 * Mock check, zero cost, what CI runs: AI_MOCK=1 pnpm eval --check
 *   It writes nothing, and fails unless every ticket's transcript and verdict equal the committed
 *   mock run's (lib/eval/check.ts): the mock's answers are known, so it proves the grader and the
 *   pipeline, not the model.
 * Real mode, by hand at rollout step 3 with Felipe's OK (spec §7), after the real index (step 2)
 * and `vercel env pull`: AI_MODEL=<provider/model> pnpm eval
 *   It writes measurements/eval-YYYY-MM-DD.json and never overwrites a good run of the same day;
 *   a run that stops early writes measurements/eval-YYYY-MM-DD-HHMMSS.aborted.json and fails.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { LanguageModel } from "ai";
import { mockRunChanges } from "@/lib/eval/check";
import { EVAL_METRIC, type EvalRun, MOCK_RUN_PATH } from "@/lib/eval/record";
import { runEval } from "@/lib/eval/run";
import { readmeLines, summarizeResults } from "@/lib/eval/summary";
import { readTickets, TICKETS_PATH, TICKETS_SHA256_PATH } from "@/lib/eval/tickets";
import { assertSafeToWrite, measurementPath } from "@/lib/measure/record";
import { INDEX_PATH } from "@/lib/rag/config";
import { loadIndex, readIndexFile } from "@/lib/rag/index-file";
import { createRetriever } from "@/lib/rag/retrieve";

// Loaded the way Next.js loads it: variables already set in the shell win.
const ENV_FILE = ".env.local";

const CHECK_FLAG = "--check";

/** True for `pnpm eval --check`; any other argument is refused, so a typo never re-records. */
function checkRequested(args: readonly string[]): boolean {
  const unknown = args.filter((arg) => arg !== CHECK_FLAG && arg !== "--");
  if (unknown.length > 0) {
    throw new Error(`Unknown argument: ${unknown.join(" ")}. The only one is ${CHECK_FLAG}.`);
  }
  return args.includes(CHECK_FLAG);
}

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/** The frozen set's SHA-256, checked against the recorded one before any ticket is asked. */
function frozenTicketsHash(): string {
  const sha256 = createHash("sha256").update(readFileSync(TICKETS_PATH)).digest("hex");
  const recorded = readFileSync(TICKETS_SHA256_PATH, "utf8").split(/\s+/)[0];
  if (sha256 !== recorded) {
    throw new Error(
      `${TICKETS_PATH} is not the frozen set: its SHA-256 is not ${TICKETS_SHA256_PATH}'s.`,
    );
  }
  return sha256;
}

function writeRun(file: string, run: EvalRun): void {
  writeFileSync(file, `${JSON.stringify(run, null, 2)}\n`);
}

async function main(): Promise<void> {
  const check = checkRequested(process.argv.slice(2));
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
  // Imported after the env file: lib/ai/model.ts reads AI_MOCK and AI_MODEL when it loads.
  const { getModel, IS_MOCK, MODEL_LABEL } = await import("@/lib/ai/model");
  const { createScenarioMockModel } = await import("@/lib/ai/mock");
  if (check && !IS_MOCK) {
    throw new Error(`${CHECK_FLAG} compares a mock run with ${MOCK_RUN_PATH}: set AI_MOCK=1.`);
  }
  // The committed mock run, read before the run, so a missing file fails at no cost.
  const committedRun = check ? (JSON.parse(readFileSync(MOCK_RUN_PATH, "utf8")) as EvalRun) : null;

  const sha256 = frozenTicketsHash();
  const set = readTickets();
  const index = readIndexFile();
  // A real run needs the real index (rollout step 2): loadIndex throws on the mock one.
  const retriever = createRetriever(loadIndex(index, { mock: IS_MOCK }));
  // The mock streams without delays, so CI runs the 24 tickets in seconds; the steps are the same.
  const model: LanguageModel = IS_MOCK
    ? createScenarioMockModel({ initialDelayInMs: 0, chunkDelayInMs: 0 })
    : getModel();

  const date = new Date().toISOString();
  const file = IS_MOCK ? MOCK_RUN_PATH : measurementPath(EVAL_METRIC, { date, aborted: false });
  // Checked before any request is spent (template spec §7.5).
  if (!IS_MOCK) assertSafeToWrite(file, false, existsSync(file));

  const mode = check ? "mock check" : "mock";
  console.log(`Mode:    ${IS_MOCK ? `${mode}: no model call, no cost` : `real: ${MODEL_LABEL}`}`);
  console.log(`Tickets: ${set.tickets.length} from ${TICKETS_PATH} (frozen ${set.frozenOn})`);
  const { results, abortReason } = await runEval({
    tickets: set.tickets,
    model,
    retriever,
    onResult: ({ id, pass, actual, latencyMs }) =>
      console.log(`  ${id} ${pass ? "pass" : "FAIL"}  ${actual}  ${latencyMs} ms`),
  });

  const aborted = abortReason !== null;
  const run: EvalRun = {
    date,
    aborted,
    abortReason,
    mock: IS_MOCK,
    model: MODEL_LABEL,
    // The mock run's own file is not a local change: every mock run rewrites it.
    commit: {
      sha: git("rev-parse", "HEAD"),
      dirty: git("status", "--porcelain", "--", ".", `:(exclude)${MOCK_RUN_PATH}`) !== "",
    },
    ticketSet: { path: TICKETS_PATH, sha256, frozenOn: set.frozenOn, tickets: set.tickets.length },
    index: {
      path: INDEX_PATH,
      model: index.model,
      corpusHash: index.corpusHash,
      chunks: index.chunks.length,
    },
    results,
    summary: aborted ? null : summarizeResults(results),
  };

  if (aborted) {
    const abortedFile = IS_MOCK
      ? MOCK_RUN_PATH
      : measurementPath(EVAL_METRIC, { date, aborted: true });
    if (!IS_MOCK) writeRun(abortedFile, run);
    throw new Error(`The run stopped: ${abortReason}.${IS_MOCK ? "" : ` Wrote ${abortedFile}.`}`);
  }

  const { summary } = run;
  if (committedRun !== null) {
    const changes = mockRunChanges(committedRun, run);
    if (changes.length > 0) {
      throw new Error(
        `This mock run differs from ${MOCK_RUN_PATH}:\n` +
          changes.map((change) => `  ${change}\n`).join("") +
          `If the change is intended, rerun AI_MOCK=1 pnpm eval and commit ${MOCK_RUN_PATH}.`,
      );
    }
    console.log(`
Passed:  ${summary!.passed} of ${summary!.tickets}
Checked: every ticket's transcript and verdict equal ${MOCK_RUN_PATH}'s. Nothing written.`);
    return;
  }

  writeRun(file, run);
  const lines = readmeLines(run, file);
  console.log(`
Passed:  ${summary!.passed} of ${summary!.tickets}
Wrote:   ${file}
${IS_MOCK ? "\nMock run: the lines below only show the format. Never paste them into the README.\n" : ""}
README line 1:
${lines.title}

First line of "How it's measured":
${lines.howMeasured}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
