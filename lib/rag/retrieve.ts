// Adapted from rag-citations (#2) lib/rag/retrieve.ts (P1 spec §4: top 5 passages). The one change:
// no refusal threshold, since P1 has no similarity gate (P-06). "spec" in the comments below
// means the rag-citations spec, and R-nn/S-nn are its decisions.
import { embed, type EmbeddingModel, embedMany } from "ai";
import { K } from "./config";
import { getEmbeddingModel } from "./embedder";
import { checkQueryDimensions, type LoadedIndex } from "./index-file";
import { createInMemoryVectorStore, type SearchResult, type VectorStore } from "./vector-store";

/** One question's passages (spec §5 steps 4–5). */
export type Retrieval = {
  /** The top K passages, best first. */
  results: SearchResult[];
  /** The best score. #2's gate compared it with a threshold; P1 only records it (P-06). */
  topScore: number;
  /** The in-memory search alone, in milliseconds, for the message metadata (S-08). */
  searchMs: number;
};

export type Retriever = {
  retrieve(question: string, options?: { abortSignal?: AbortSignal }): Promise<Retrieval>;
};

/**
 * Real mode searches the stored vectors. Mock mode embeds every chunk's text with the mock
 * embedder at the first question, in memory (spec §4.3, R-19): concurrent first questions share
 * the build, and a failed build is retried at the next question.
 */
function storeLoader(index: LoadedIndex, model: EmbeddingModel): () => Promise<VectorStore> {
  if (!index.mock) {
    const store = Promise.resolve(createInMemoryVectorStore(index.entries));
    return () => store;
  }
  const { chunks } = index;
  let store: Promise<VectorStore> | undefined;
  return () => {
    store ??= embedMany({ model, values: chunks.map(({ text }) => text) }).then(
      ({ embeddings }) =>
        createInMemoryVectorStore(chunks.map((chunk, i) => ({ chunk, vector: embeddings[i] }))),
      (error: unknown) => {
        store = undefined;
        throw error;
      },
    );
    return store;
  };
}

/**
 * Embeds a question and searches the index for its top K passages (spec §4.4). Build it from
 * loadIndex(), which has already applied the loading rules (spec §4.3).
 */
export function createRetriever(index: LoadedIndex): Retriever {
  const model = getEmbeddingModel(index);
  const getStore = storeLoader(index, model);
  const dimensions = index.mock ? null : index.dimensions;

  return {
    async retrieve(question, { abortSignal } = {}) {
      const store = await getStore();
      const { embedding } = await embed({ model, value: question, abortSignal });
      if (dimensions !== null) checkQueryDimensions(embedding, dimensions);

      const start = performance.now();
      const results = await store.search(embedding, K);
      const searchMs = performance.now() - start;

      if (results.length === 0) throw new Error("The index has no passages");
      return { results, topScore: results[0].score, searchMs };
    },
  };
}
