import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chunkCorpus } from "@/lib/rag/chunk";
import { HELP_CENTER_DIR, INDEX_PATH } from "@/lib/rag/config";
import { corpusHash, readCorpus } from "@/lib/rag/corpus";
import { readIndexFile } from "@/lib/rag/index-file";

// A stale index fails here: rebuild it with `AI_MOCK=1 pnpm build-index` (spec §4). Adapted from
// rag-citations (#2) tests/corpus.test.ts.
describe("content/help-center-index.json", () => {
  const files = readCorpus(HELP_CENTER_DIR);
  const index = readIndexFile();

  it("is the file at INDEX_PATH", () => {
    expect(index).toStrictEqual(JSON.parse(readFileSync(INDEX_PATH, "utf8")));
  });

  it("was built from the committed help center", () => {
    expect(files).toHaveLength(15);
    expect(index.corpusHash).toBe(corpusHash(files));
  });

  it("holds exactly the chunks the chunker makes from the committed help center", () => {
    const committed = index.chunks.map(({ id, file, heading, startLine, endLine, text }) => ({
      id,
      file,
      heading,
      startLine,
      endLine,
      text,
    }));
    expect(committed).toEqual(chunkCorpus(files));
  });

  // Until rollout step 2 (spec §7) the committed index is the mock one: no vectors, no cost.
  it("is the mock index, or a real one whose every chunk has a vector", () => {
    if (index.model === "mock") {
      expect(index.dimensions).toBeNull();
      expect(index.chunks.every((chunk) => chunk.vector === undefined)).toBe(true);
    } else {
      expect(index.dimensions).toBeGreaterThan(0);
      expect(index.chunks.every((chunk) => typeof chunk.vector === "string")).toBe(true);
    }
  });
});
