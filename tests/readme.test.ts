import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MOCK_RUN_PATH, type EvalRun } from "@/lib/eval/record";
import { type ReadmeLines, readmeLines } from "@/lib/eval/summary";
import { TICKET_MIX, type TicketKind } from "@/lib/eval/tickets";
import { pickRunFile } from "@/lib/inbox/run";
import { PRODUCT_NAME } from "@/lib/project";
import { slugify } from "@/lib/rag/chunk";

// The README (template spec §8; spec §5): one screen, the skeleton's sections, and the lines the
// eval prints. Line 1 and the first line of "How it's measured" carry the measured number, so they
// are pasted from `pnpm eval`, never typed (template spec §7.5).

const readme = readFileSync("README.md", "utf8");
const lines = readme.trimEnd().split("\n");

// What the README shows until the first real run (rollout step 3, spec §7).
const PENDING: ReadmeLines = {
  title: `# ${PRODUCT_NAME} — tickets handled correctly: pending the first eval run`,
  howMeasured:
    "Pending: the first eval run prints this line: the share of tickets handled correctly with " +
    "its 95% CI, the tickets handled per kind, the citation-verified rate, the median latency " +
    "and tokens per ticket, the model, the date, the commit and a link to the raw data. Until " +
    "then the inbox and the Evals page show a mock run, labelled as one.",
};

/** The lines `pnpm eval` printed for the shown real run, or PENDING before the first one. */
function measuredLines(): ReadmeLines {
  const file = pickRunFile(readdirSync(path.dirname(MOCK_RUN_PATH)));
  if (file === MOCK_RUN_PATH) return PENDING;
  return readmeLines(JSON.parse(readFileSync(file, "utf8")) as EvalRun, file);
}

/** The lines under a `## ` heading, up to the next one. */
function section(heading: string): string[] {
  const start = lines.indexOf(`## ${heading}`);
  expect(start, `## ${heading}`).toBeGreaterThan(0);
  const end = lines.findIndex((line, i) => i > start && line.startsWith("## "));
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

/** The GitHub anchors of a Markdown file's headings. */
function anchors(file: string): string[] {
  return [...readFileSync(file, "utf8").matchAll(/^#{1,6} +(.+)$/gm)].map(([, text]) =>
    slugify(text.trim()),
  );
}

const KINDS = Object.keys(TICKET_MIX) as TicketKind[];

describe("README.md", () => {
  it("fits one screen: 40 lines at most (template spec §8)", () => {
    expect(lines.length).toBeLessThanOrEqual(40);
  });

  it("has the skeleton's sections in order, plus License", () => {
    const headings = lines.filter((line) => line.startsWith("## "));
    expect(headings).toEqual([
      "## Problem",
      "## Decisions",
      "## How it's measured",
      "## Run it",
      "## Stack",
      "## License",
    ]);
  });

  it("holds the lines of the shown real run, or the pending ones before the first", () => {
    const expected = measuredLines();
    expect(lines[0]).toBe(expected.title);
    expect(section("How it's measured")[0]).toBe(expected.howMeasured);
  });

  it("states the frozen set's size and mix as lib/eval/tickets.ts holds them", () => {
    const total = KINDS.reduce((sum, kind) => sum + TICKET_MIX[kind], 0);
    const mix = KINDS.map((kind) => `${TICKET_MIX[kind]} ${kind}`).join(", ");
    expect(section("How it's measured").join("\n")).toContain(
      `${total} frozen English tickets in [measurements/tickets.json](measurements/tickets.json) (${mix})`,
    );
  });

  it("states a pass rule for each kind of ticket (spec §5)", () => {
    const measured = section("How it's measured").join("\n");
    for (const kind of KINDS) expect(measured).toContain(`**${kind}:**`);
  });

  it("names the mock eval check that CI runs", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    expect(ci).toMatch(/^\s+- run: pnpm eval --check$/m);
    expect(section("How it's measured").join("\n")).toContain("`pnpm eval --check`");
  });

  it("runs with no API key: pnpm install && pnpm dev:mock (template spec §8)", () => {
    expect(section("Run it")[0]).toMatch(/^`pnpm install && pnpm dev:mock` \(no API key needed/);
  });

  it("links only to repo files and headings that exist", () => {
    const targets = [...readme.matchAll(/\]\(([^)]+)\)/g)]
      .map(([, target]) => target)
      .filter((target) => !/^(https?:|<)/.test(target));
    expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      const [file, anchor] = target.split("#");
      expect(existsSync(file), target).toBe(true);
      if (anchor !== undefined) expect(anchors(file), target).toContain(anchor);
    }
  });
});
