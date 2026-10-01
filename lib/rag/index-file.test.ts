// Copied from rag-citations (#2) lib/rag/index-file.test.ts, without the corpus tag, commit and
// threshold, which P1 does not have (spec §4, P-06). "spec" below means the rag-citations spec.
import { embedMany, type EmbedManyResult } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Chunk, chunkCorpus } from "./chunk";
import { type CorpusFile, corpusHash } from "./corpus";
import {
  buildIndex,
  checkQueryDimensions,
  decodeVector,
  encodeVector,
  type IndexFile,
  loadIndex,
  loadVectors,
  resolveEmbeddingModel,
  serializeIndex,
} from "./index-file";

// Real mode is tested with a mocked embedMany only: no test ever reaches the Gateway.
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  embedMany: vi.fn(),
}));

const MODEL = "test/embedding-model";
const BUILT_AT = new Date("2026-09-28T12:00:00.000Z");

const FILES: CorpusFile[] = [
  { file: "a.md", content: "---\ntitle: Alpha\n---\n\nIntro.\n\n## One\nFirst.\n" },
  { file: "b.md", content: "---\ntitle: Beta\n---\n\n## Two\nSecond.\n" },
];

const ALPHA: Chunk = {
  id: "a",
  file: "a.md",
  heading: "Alpha",
  startLine: 4,
  endLine: 6,
  text: "\nIntro.\n",
};
const BETA: Chunk = {
  id: "b#two",
  file: "b.md",
  heading: "Beta › Two",
  startLine: 5,
  endLine: 6,
  text: "## Two\nSecond.",
};

/** A real-mode index of two chunks with 3-dimensional vectors. */
function indexFile(overrides: Partial<IndexFile> = {}): IndexFile {
  return {
    model: MODEL,
    dimensions: 3,
    corpusHash: "0".repeat(64),
    builtAt: BUILT_AT.toISOString(),
    chunks: [
      { ...ALPHA, vector: "AACAPwAAAMAAAAA/" }, // [1, -2, 0.5]
      { ...BETA, vector: "AAAAAAAAAD8AAADA" }, // [0, 0.5, -2]
    ],
    ...overrides,
  };
}

/** What embedMany resolves to for these vectors. */
function embedded(embeddings: number[][], tokens = 42): EmbedManyResult {
  return { values: [], embeddings, usage: { tokens }, warnings: [] };
}

// Expected encodings computed outside the code under test:
// python3 -c "import struct,base64;print(base64.b64encode(struct.pack('<3f',1,-2,0.5)).decode())"
describe("encodeVector and decodeVector", () => {
  it("store each value as a little-endian float32, in base64", () => {
    expect(encodeVector([1, -2, 0.5])).toBe("AACAPwAAAMAAAAA/");
    expect(decodeVector("AAAAAAAAAD8AAADA")).toEqual([0, 0.5, -2]);
  });

  it("round-trip a vector to its float32 values", () => {
    const vector = [0.1, -0.023456789, 1 / 3];
    expect(decodeVector(encodeVector(vector))).toEqual(vector.map(Math.fround));
  });

  it("reject bytes that are not whole float32 values", () => {
    expect(() => decodeVector("AAAA")).toThrow(/whole float32 values/);
  });
});

describe("resolveEmbeddingModel", () => {
  it("returns null in mock mode, even when EMBEDDING_MODEL is set", () => {
    expect(resolveEmbeddingModel({ AI_MOCK: "1", EMBEDDING_MODEL: MODEL })).toBeNull();
  });

  it("returns the trimmed EMBEDDING_MODEL in real mode", () => {
    expect(resolveEmbeddingModel({ EMBEDDING_MODEL: `  ${MODEL}\n` })).toBe(MODEL);
  });

  it('only "1" enables mock mode', () => {
    expect(resolveEmbeddingModel({ AI_MOCK: "true", EMBEDDING_MODEL: MODEL })).toBe(MODEL);
  });

  it("throws in real mode when EMBEDDING_MODEL is missing or blank", () => {
    expect(() => resolveEmbeddingModel({})).toThrow(/EMBEDDING_MODEL is not set/);
    expect(() => resolveEmbeddingModel({ EMBEDDING_MODEL: "  " })).toThrow(
      /EMBEDDING_MODEL is not set/,
    );
  });
});

describe("buildIndex", () => {
  beforeEach(() => {
    vi.mocked(embedMany).mockReset();
  });

  it("builds the mock index: the real chunks, model mock, no dimensions, no vectors", async () => {
    const { index, tokens } = await buildIndex({
      files: FILES,
      embeddingModel: null,
      builtAt: BUILT_AT,
    });
    expect(index).toStrictEqual({
      model: "mock",
      dimensions: null,
      corpusHash: corpusHash(FILES),
      builtAt: "2026-09-28T12:00:00.000Z",
      chunks: chunkCorpus(FILES),
    });
    expect(tokens).toBeNull();
    expect(embedMany).not.toHaveBeenCalled();
  });

  it("embeds every chunk's text with one embedMany call in real mode", async () => {
    vi.mocked(embedMany).mockResolvedValue(
      embedded([
        [1, -2, 0.5],
        [0, 0.5, -2],
        [0.25, 0, 1],
      ]),
    );
    const { index, tokens } = await buildIndex({
      files: FILES,
      embeddingModel: MODEL,
      builtAt: BUILT_AT,
    });
    const [first, second, third] = chunkCorpus(FILES);
    expect(embedMany).toHaveBeenCalledTimes(1);
    expect(embedMany).toHaveBeenCalledWith({
      model: MODEL,
      values: [first.text, second.text, third.text],
    });
    expect(index).toMatchObject({ model: MODEL, dimensions: 3, corpusHash: corpusHash(FILES) });
    expect(index.chunks).toStrictEqual([
      { ...first, vector: "AACAPwAAAMAAAAA/" },
      { ...second, vector: "AAAAAAAAAD8AAADA" },
      { ...third, vector: encodeVector([0.25, 0, 1]) },
    ]);
    expect(tokens).toBe(42);
  });

  it("throws when the embeddings differ in length", async () => {
    vi.mocked(embedMany).mockResolvedValue(
      embedded([
        [1, 0, 0],
        [1, 0],
        [0, 1, 0],
      ]),
    );
    await expect(
      buildIndex({ files: FILES, embeddingModel: MODEL, builtAt: BUILT_AT }),
    ).rejects.toThrow(/a#one has 2 dimensions; the first chunk has 3/);
  });

  it("throws when the corpus has no chunks", async () => {
    await expect(
      buildIndex({ files: [], embeddingModel: null, builtAt: BUILT_AT }),
    ).rejects.toThrow(/no chunks/);
    expect(embedMany).not.toHaveBeenCalled();
  });
});

describe("serializeIndex", () => {
  it("writes JSON indented by two spaces, with a final newline", () => {
    const index = indexFile();
    const json = serializeIndex(index);
    expect(json.split("\n").slice(0, 3)).toEqual([
      "{",
      `  "model": "${MODEL}",`,
      '  "dimensions": 3,',
    ]);
    expect(json.endsWith("\n  ]\n}\n")).toBe(true);
    expect(JSON.parse(json)).toStrictEqual(index);
  });
});

// #2's loading rules (rag-citations spec §4.3), one test per rule. P1 has no similarity gate
// (spec §4, P-06), so the rule on the refusal threshold is gone.
describe("loadIndex", () => {
  it("ignores the stored vectors and model in mock mode (R-19)", () => {
    expect(loadIndex(indexFile(), { mock: true })).toStrictEqual({
      mock: true,
      chunks: [ALPHA, BETA],
    });
  });

  it("loads a mock-mode index in mock mode", () => {
    const index = indexFile({ model: "mock", dimensions: null, chunks: [ALPHA, BETA] });
    expect(loadIndex(index, { mock: true })).toStrictEqual({
      mock: true,
      chunks: [ALPHA, BETA],
    });
  });

  it("returns the model, dimensions and each chunk's vector in real mode", () => {
    expect(loadIndex(indexFile(), { mock: false })).toStrictEqual({
      mock: false,
      model: MODEL,
      dimensions: 3,
      entries: [
        { chunk: ALPHA, vector: [1, -2, 0.5] },
        { chunk: BETA, vector: [0, 0.5, -2] },
      ],
    });
  });

  it('throws in real mode when the model is "mock"', () => {
    const load = (index: IndexFile) => () => loadIndex(index, { mock: false });
    expect(load(indexFile({ model: "mock" }))).toThrow(/is a mock-mode index/);
    // No dimensions marks a mock-mode index too.
    expect(load(indexFile({ dimensions: null }))).toThrow(/is a mock-mode index/);
  });

  it("throws in real mode when a vector is missing", () => {
    const index = indexFile();
    delete index.chunks[1].vector;
    expect(() => loadIndex(index, { mock: false })).toThrow(/no vector for b#two/);
  });

  it("throws in real mode when a vector's length differs from dimensions", () => {
    expect(() => loadIndex(indexFile({ dimensions: 4 }), { mock: false })).toThrow(
      /a has 3 dimensions; the index has 4/,
    );
  });
});

// The vector rules alone, as #2 exposes them.
describe("loadVectors", () => {
  it("returns the model, dimensions and each chunk's vector", () => {
    expect(loadVectors(indexFile())).toStrictEqual({
      model: MODEL,
      dimensions: 3,
      entries: [
        { chunk: ALPHA, vector: [1, -2, 0.5] },
        { chunk: BETA, vector: [0, 0.5, -2] },
      ],
    });
  });

  it("throws on a mock-mode index and on a missing vector", () => {
    expect(() => loadVectors(indexFile({ model: "mock" }))).toThrow(/is a mock-mode index/);
    const index = indexFile();
    delete index.chunks[0].vector;
    expect(() => loadVectors(index)).toThrow(/no vector for a/);
  });
});

// The last loading rule applies at query time, to the first query embedding.
describe("checkQueryDimensions", () => {
  it("accepts a query embedding of the index's dimensions", () => {
    expect(() => checkQueryDimensions([0.1, 0.2, 0.3], 3)).not.toThrow();
  });

  it("throws when the lengths differ", () => {
    expect(() => checkQueryDimensions([0.1, 0.2], 3)).toThrow(
      /query embedding has 2 dimensions; the index has 3/,
    );
  });
});
