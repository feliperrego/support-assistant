// Copied from rag-citations (#2) lib/rag/embedder.test.ts; the real-mode index has no threshold
// (spec §4, P-06). "spec" below means the rag-citations spec, and R-nn/S-nn are its decisions.
import { cosineSimilarity, embed, embedMany } from "ai";
import { MockEmbeddingModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import {
  createMockEmbeddingModel,
  getEmbeddingModel,
  MOCK_EMBEDDING_DIMENSIONS,
  mockEmbedding,
  mockWords,
} from "./embedder";

describe("mockWords", () => {
  it("lower-cases runs of letters and digits and drops words shorter than three", () => {
    expect(mockWords("How do I embed many values in parallel?")).toEqual([
      "how",
      "embed",
      "many",
      "values",
      "parallel",
    ]);
  });

  it("splits code, markup and magic tokens at every other character", () => {
    expect(mockWords("`embedMany({ maxParallelCalls: 2 })` [[notfound]]")).toEqual([
      "embedmany",
      "maxparallelcalls",
      "notfound",
    ]);
  });

  it("keeps accented letters inside a word", () => {
    expect(mockWords("Como testar meu código?")).toEqual(["como", "testar", "meu", "código"]);
  });
});

describe("mockEmbedding", () => {
  it("has MOCK_EMBEDDING_DIMENSIONS entries, all zero for a text without words", () => {
    const vector = mockEmbedding("I do. A b?");
    expect(vector).toHaveLength(MOCK_EMBEDDING_DIMENSIONS);
    expect(vector.every((value) => value === 0)).toBe(true);
  });

  // Expected slots and signs computed outside the code under test:
  // python3 -c "import hashlib; d=hashlib.sha256('rerank'.encode()).digest();
  //   print(int.from_bytes(d[:4], 'little') % 4096, -1 if d[4] & 1 else 1)"
  it("adds ±1 per occurrence at the slot and sign the word's SHA-256 picks", () => {
    const vector = mockEmbedding("rerank documents, rerank");
    expect(vector[1662]).toBe(-2);
    expect(vector[1691]).toBe(1);
    expect(vector.filter((value) => value !== 0)).toHaveLength(2);
  });

  it("hashes the word's UTF-8 bytes", () => {
    expect(mockEmbedding("código")[3569]).toBe(1);
  });

  it("ignores case, word order and punctuation", () => {
    expect(mockEmbedding("Rerank the documents!")).toEqual(mockEmbedding("documents; the RERANK"));
  });

  it("scores two texts by the words they share", () => {
    const question = mockEmbedding("How do I rerank documents?");
    expect(cosineSimilarity(question, mockEmbedding("documents, how to rerank"))).toBeCloseTo(1);
    const shared = cosineSimilarity(question, mockEmbedding("Rerank search results"));
    expect(shared).toBeGreaterThan(0);
    expect(shared).toBeLessThan(1);
    expect(cosineSimilarity(question, mockEmbedding("Stream text to the client"))).toBe(0);
  });
});

describe("createMockEmbeddingModel", () => {
  it("overrides the MockEmbeddingModelV4 defaults of 1 value per call and no parallel calls", () => {
    const model = createMockEmbeddingModel();
    expect(model).toBeInstanceOf(MockEmbeddingModelV4);
    expect(model.maxEmbeddingsPerCall).toBe(2048);
    expect(model.supportsParallelCalls).toBe(true);
  });

  it("embeds many values in one call, each as mockEmbedding does", async () => {
    const model = createMockEmbeddingModel();
    const values = ["Embed many values", "Rerank documents", "Test without a model"];
    const { embeddings } = await embedMany({ model, values });
    expect(model.doEmbedCalls).toHaveLength(1);
    expect(embeddings).toEqual(values.map(mockEmbedding));
  });

  it("embeds one value with embed()", async () => {
    const { embedding } = await embed({ model: createMockEmbeddingModel(), value: "Rerank" });
    expect(embedding).toEqual(mockEmbedding("Rerank"));
  });
});

describe("getEmbeddingModel", () => {
  it("is the mock in mock mode (R-19)", () => {
    expect(getEmbeddingModel({ mock: true, chunks: [] })).toBeInstanceOf(MockEmbeddingModelV4);
  });

  it("is the index's own model id in real mode, for the Gateway (S-18)", () => {
    const model = getEmbeddingModel({
      mock: false,
      model: "test/embedding-model",
      dimensions: 3,
      entries: [],
    });
    expect(model).toBe("test/embedding-model");
  });
});
