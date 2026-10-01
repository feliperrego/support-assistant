// Copied from rag-citations (#2) lib/rag/vector-store.test.ts; only ".mdx" file names became ".md".
import { describe, expect, it } from "vitest";
import type { Chunk } from "./chunk";
import type { IndexEntry } from "./index-file";
import { createInMemoryVectorStore } from "./vector-store";

function chunk(id: string): Chunk {
  return { id, file: `${id}.md`, heading: id, startLine: 1, endLine: 2, text: `${id} text` };
}

function entry(id: string, vector: number[]): IndexEntry {
  return { chunk: chunk(id), vector };
}

const STORE = createInMemoryVectorStore([
  entry("east", [1, 0]),
  entry("north", [0, 1]),
  entry("north-east", [1, 1]),
  entry("west", [-1, 0]),
]);

describe("createInMemoryVectorStore", () => {
  it("returns the k entries most similar to the vector, best first, with their scores", async () => {
    const results = await STORE.search([1, 0], 3);
    expect(results.map(({ chunk }) => chunk)).toEqual([
      chunk("east"),
      chunk("north-east"),
      chunk("north"),
    ]);
    expect(results[0].score).toBeCloseTo(1);
    expect(results[1].score).toBeCloseTo(Math.SQRT1_2);
    expect(results[2].score).toBeCloseTo(0);
  });

  it("returns every entry when k is larger than the store", async () => {
    const results = await STORE.search([-1, 0], 10);
    expect(results.map(({ chunk }) => chunk.id)).toEqual(["west", "north", "north-east", "east"]);
    expect(results[3].score).toBeCloseTo(-1);
  });

  it("keeps the entries' order between equal scores", async () => {
    const store = createInMemoryVectorStore([entry("b", [0, 2]), entry("a", [0, 1])]);
    expect((await store.search([0, 3], 2)).map(({ chunk }) => chunk.id)).toEqual(["b", "a"]);
  });

  it("scores a zero vector 0, as cosineSimilarity does (spec §4.4)", async () => {
    const results = await STORE.search([0, 0], 4);
    expect(results.map(({ score }) => score)).toEqual([0, 0, 0, 0]);
  });

  it("rejects a vector whose length is not the entries' (spec §4.4)", async () => {
    await expect(STORE.search([1, 0, 0], 1)).rejects.toThrow("Vectors must have the same length");
  });
});
