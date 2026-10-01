// Copied from rag-citations (#2) lib/rag/retrieve.test.ts, without the threshold tests: P1 has no
// similarity gate (spec §4, P-06). "spec" below means the rag-citations spec.
import { cosineSimilarity, embed, type EmbedResult, embedMany } from "ai";
import { MockEmbeddingModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chunk } from "./chunk";
import { K } from "./config";
import { mockEmbedding } from "./embedder";
import type { LoadedIndex } from "./index-file";
import { createRetriever } from "./retrieve";

// embed and embedMany keep their real behaviour unless a test overrides them, so mock mode runs
// end to end; real mode is tested with a mocked embed only and never reaches the Gateway.
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return { ...actual, embed: vi.fn(actual.embed), embedMany: vi.fn(actual.embedMany) };
});

beforeEach(() => {
  // Restores the real embed and embedMany, and clears their calls.
  vi.resetAllMocks();
});

function chunk(id: string, text = `${id} text`): Chunk {
  return { id, file: `${id}.md`, heading: id, startLine: 1, endLine: 2, text };
}

/** What embed resolves to for this embedding. */
function embedded(embedding: number[]): EmbedResult {
  return { value: "", embedding, usage: { tokens: 1 }, warnings: [] };
}

describe("createRetriever in real mode", () => {
  const MODEL = "test/embedding-model";
  // Cosine similarity with the query [1, 0, 0], best first: a 1, b 0.89, c 0.71, e 0.33, d 0, f -1.
  const INDEX: LoadedIndex = {
    mock: false,
    model: MODEL,
    dimensions: 3,
    entries: [
      { chunk: chunk("d"), vector: [0, 1, 0] },
      { chunk: chunk("b"), vector: [2, 1, 0] },
      { chunk: chunk("f"), vector: [-1, 0, 0] },
      { chunk: chunk("a"), vector: [1, 0, 0] },
      { chunk: chunk("e"), vector: [1, 2, 2] },
      { chunk: chunk("c"), vector: [1, 1, 0] },
    ],
  };

  beforeEach(() => {
    vi.mocked(embed).mockResolvedValue(embedded([1, 0, 0]));
  });

  it("embeds the question with the index's own model (S-18), passing the abort signal", async () => {
    const { signal } = new AbortController();
    await createRetriever(INDEX).retrieve("How do I rerank?", { abortSignal: signal });
    expect(embed).toHaveBeenCalledOnce();
    expect(embed).toHaveBeenCalledWith(
      expect.objectContaining({ model: MODEL, value: "How do I rerank?", abortSignal: signal }),
    );
    expect(embedMany).not.toHaveBeenCalled();
  });

  it("returns the top K passages by score, best first, and the top score (spec §4.4)", async () => {
    const { results, topScore } = await createRetriever(INDEX).retrieve("q");
    expect(K).toBe(5);
    expect(results.map(({ chunk }) => chunk.id)).toEqual(["a", "b", "c", "e", "d"]);
    expect(results.map(({ score }) => score)).toEqual([
      1,
      2 / Math.sqrt(5),
      1 / Math.sqrt(2),
      1 / 3,
      0,
    ]);
    expect(topScore).toBe(1);
  });

  it("times the search alone, without the embedding (S-08)", async () => {
    vi.mocked(embed).mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return embedded([1, 0, 0]);
    });
    const { searchMs } = await createRetriever(INDEX).retrieve("q");
    expect(searchMs).toBeGreaterThanOrEqual(0);
    expect(searchMs).toBeLessThan(50);
  });

  it("rejects a query embedding whose length is not the index's dimensions (spec §4.3)", async () => {
    vi.mocked(embed).mockResolvedValueOnce(embedded([1, 0]));
    await expect(createRetriever(INDEX).retrieve("q")).rejects.toThrow(
      "The query embedding has 2 dimensions; the index has 3",
    );
  });

  it("rejects a question when the index has no passages", async () => {
    await expect(createRetriever({ ...INDEX, entries: [] }).retrieve("q")).rejects.toThrow(
      "The index has no passages",
    );
  });
});

describe("createRetriever in mock mode", () => {
  const CHUNKS = [
    chunk(
      "embeddings",
      "Use embedMany to embed many values. Set maxParallelCalls to run in parallel.",
    ),
    chunk("reranking", "Rerank documents by their relevance to a query with the rerank function."),
    chunk("testing", "Test your code with mock providers instead of calling a real model."),
  ];
  const INDEX: LoadedIndex = { mock: true, chunks: CHUNKS };

  it("embeds nothing before the first question (spec §4.3, R-19)", () => {
    createRetriever(INDEX);
    expect(embedMany).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();
  });

  it("embeds every chunk's text with the mock in one call, once, at the first question", async () => {
    const retriever = createRetriever(INDEX);
    await Promise.all([retriever.retrieve("rerank"), retriever.retrieve("embed")]);
    await retriever.retrieve("test");
    expect(embedMany).toHaveBeenCalledOnce();
    const [{ model, values }] = vi.mocked(embedMany).mock.calls[0];
    expect(model).toBeInstanceOf(MockEmbeddingModelV4);
    expect(values).toEqual(CHUNKS.map(({ text }) => text));
  });

  it("embeds the question with the mock and ranks by shared words", async () => {
    const question = "How do I rerank documents?";
    const { results, topScore } = await createRetriever(INDEX).retrieve(question);
    expect(vi.mocked(embed).mock.calls[0][0].model).toBeInstanceOf(MockEmbeddingModelV4);
    expect(results.map(({ chunk }) => chunk.id)).toEqual(["reranking", "embeddings", "testing"]);
    expect(topScore).toBe(cosineSimilarity(mockEmbedding(question), mockEmbedding(CHUNKS[1].text)));
  });

  it("builds again at the next question after a failed build", async () => {
    vi.mocked(embedMany).mockRejectedValueOnce(new Error("build failed"));
    const retriever = createRetriever(INDEX);
    await expect(retriever.retrieve("rerank")).rejects.toThrow("build failed");
    const { results } = await retriever.retrieve("rerank");
    expect(results[0].chunk.id).toBe("reranking");
    expect(embedMany).toHaveBeenCalledTimes(2);
  });
});
