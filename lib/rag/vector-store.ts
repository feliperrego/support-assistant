// Copied from rag-citations (#2) lib/rag/vector-store.ts unchanged (spec §4). "spec" in the comments below
// means the rag-citations spec, and R-nn/S-nn are its decisions.
import { cosineSimilarity } from "ai";
import type { Chunk } from "./chunk";
import type { IndexEntry } from "./index-file";

/** A passage and its cosine similarity to the query, from -1 to 1. */
export type SearchResult = { chunk: Chunk; score: number };

/**
 * The search seam (spec §4.4). A vector-database adapter goes behind it when the §2 trigger
 * fires, which is why search returns a promise.
 */
export type VectorStore = {
  /** The k passages most similar to the vector, best first. */
  search(vector: number[], k: number): Promise<SearchResult[]>;
};

/**
 * Scores every entry with cosineSimilarity from ai and keeps the top k (spec §4.4). The sort is
 * stable, so equal scores keep the entries' order. A zero vector scores 0, and a vector of
 * another length throws.
 */
export function createInMemoryVectorStore(entries: readonly IndexEntry[]): VectorStore {
  return {
    async search(vector, k) {
      return entries
        .map(({ chunk, vector: entryVector }) => ({
          chunk,
          score: cosineSimilarity(vector, entryVector),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    },
  };
}
