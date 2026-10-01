// Adapted from rag-citations (#2) lib/rag/index-file.ts (P1 spec §4: an in-memory index committed
// as JSON). Changes: no corpus tag or commit (P1's help center has no upstream), no refusal
// threshold (no similarity gate, P-06), and the file is content/help-center-index.json.
// "spec" in the comments below means the rag-citations spec unless it says P1.
import { readFileSync } from "node:fs";
import path from "node:path";
import { embedMany } from "ai";
import { type Chunk, chunkCorpus } from "./chunk";
import { INDEX_PATH } from "./config";
import { type CorpusFile, corpusHash } from "./corpus";

/** The `model` of an index built in mock mode (spec §4.2). */
export const MOCK_MODEL = "mock";

/** A stored chunk. In real mode it carries its embedding: little-endian float32, in base64. */
export type IndexChunk = Chunk & { vector?: string };

/** content/help-center-index.json (spec §4.2, S-07). */
export type IndexFile = {
  /** The Gateway embedding model id, or "mock". The route embeds questions with it (S-18). */
  model: string;
  /** The length of every vector; null in mock mode. */
  dimensions: number | null;
  /** corpusHash() of the files the chunks come from. */
  corpusHash: string;
  /** When the index was built, in ISO 8601. */
  builtAt: string;
  chunks: IndexChunk[];
};

/** A chunk and its embedding, as the vector store searches them (spec §4.4). */
export type IndexEntry = { chunk: Chunk; vector: number[] };

/** The index after the loading rules (spec §4.3). */
export type LoadedIndex =
  /** Mock mode re-embeds each chunk's text with the mock embedder, at the first request (R-19). */
  | { mock: true; chunks: Chunk[] }
  | { mock: false; model: string; dimensions: number; entries: IndexEntry[] };

// Base64 float32 is lossless for the model's float32 output and the smallest file (S-07).
const FLOAT32_BYTES = 4;

export function encodeVector(vector: readonly number[]): string {
  const view = new DataView(new ArrayBuffer(vector.length * FLOAT32_BYTES));
  vector.forEach((value, i) => view.setFloat32(i * FLOAT32_BYTES, value, true));
  return Buffer.from(view.buffer).toString("base64");
}

export function decodeVector(encoded: string): number[] {
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.byteLength % FLOAT32_BYTES !== 0) {
    throw new RangeError(`A vector of ${bytes.byteLength} bytes is not whole float32 values`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length: bytes.byteLength / FLOAT32_BYTES }, (_, i) =>
    view.getFloat32(i * FLOAT32_BYTES, true),
  );
}

/**
 * The embedding model a build uses: null in mock mode (AI_MOCK=1), otherwise EMBEDDING_MODEL,
 * the only place its id lives (S-18). It reads AI_MOCK itself, because importing lib/ai/model.ts
 * would also demand AI_MODEL, which a build never uses.
 */
export function resolveEmbeddingModel(
  env: Readonly<Record<string, string | undefined>>,
): string | null {
  if (env.AI_MOCK === "1") return null;
  const model = env.EMBEDDING_MODEL?.trim();
  if (!model) {
    throw new Error(
      'EMBEDDING_MODEL is not set. Set it to a "provider/model" embedding id (see .env.example), ' +
        "or set AI_MOCK=1 to build the mock index.",
    );
  }
  return model;
}

export type BuildIndexOptions = {
  files: readonly CorpusFile[];
  /** null builds the mock index: no model call and no vectors (spec §4.2). */
  embeddingModel: string | null;
  builtAt: Date;
};

/** The index, and the tokens the real build's one embedMany call used (null in mock mode). */
export type BuiltIndex = { index: IndexFile; tokens: number | null };

/** Builds the index file's content from the help-center files (spec §4.2). */
export async function buildIndex({
  files,
  embeddingModel,
  builtAt,
}: BuildIndexOptions): Promise<BuiltIndex> {
  const chunks = chunkCorpus(files);
  if (chunks.length === 0) throw new Error("The corpus has no chunks");
  const metadata = { corpusHash: corpusHash(files), builtAt: builtAt.toISOString() };

  if (embeddingModel === null) {
    return { index: { model: MOCK_MODEL, dimensions: null, ...metadata, chunks }, tokens: null };
  }

  // One call: the Gateway takes up to 2,048 values per request (spec §4.2).
  const { embeddings, usage } = await embedMany({
    model: embeddingModel,
    values: chunks.map((chunk) => chunk.text),
  });
  const dimensions = embeddings[0].length;
  embeddings.forEach((embedding, i) => {
    if (embedding.length !== dimensions) {
      throw new Error(
        `${chunks[i].id} has ${embedding.length} dimensions; the first chunk has ${dimensions}`,
      );
    }
  });
  return {
    index: {
      model: embeddingModel,
      dimensions,
      ...metadata,
      chunks: chunks.map((chunk, i) => ({ ...chunk, vector: encodeVector(embeddings[i]) })),
    },
    tokens: usage.tokens,
  };
}

/** Two-space JSON with a final newline, so a rebuild's diff shows each changed chunk. */
export function serializeIndex(index: IndexFile): string {
  return `${JSON.stringify(index, null, 2)}\n`;
}

/**
 * Reads content/help-center-index.json (INDEX_PATH) under the working directory. The path is a
 * literal so the build traces exactly this file; a computed path makes it trace the whole
 * project (spec §4.4).
 */
export function readIndexFile(): IndexFile {
  const json = readFileSync(path.join(process.cwd(), "content/help-center-index.json"), "utf8");
  return JSON.parse(json) as IndexFile;
}

/** The chunk without its stored vector. */
function toChunk({ id, file, heading, startLine, endLine, text }: IndexChunk): Chunk {
  return { id, file, heading, startLine, endLine, text };
}

/** A real-mode index's model and vectors. */
export type IndexVectors = { model: string; dimensions: number; entries: IndexEntry[] };

/**
 * The loading rules on a real-mode index's vectors (spec §4.3, S-07): it throws when the index is
 * a mock-mode one, when a vector is missing, or when a vector's length is not `dimensions`.
 */
export function loadVectors(index: IndexFile): IndexVectors {
  const { model, dimensions } = index;
  const rebuild = "Rebuild it with EMBEDDING_MODEL set: pnpm build-index (P1 spec §7, step 2).";
  if (model === MOCK_MODEL || dimensions === null) {
    throw new Error(
      `${INDEX_PATH} is a mock-mode index (model "${model}", dimensions ${dimensions}). ${rebuild}`,
    );
  }
  const entries = index.chunks.map((chunk) => {
    if (chunk.vector === undefined) {
      throw new Error(`${INDEX_PATH} has no vector for ${chunk.id}. ${rebuild}`);
    }
    const vector = decodeVector(chunk.vector);
    if (vector.length !== dimensions) {
      throw new Error(`${chunk.id} has ${vector.length} dimensions; the index has ${dimensions}`);
    }
    return { chunk: toChunk(chunk), vector };
  });
  return { model, dimensions, entries };
}

/**
 * Applies the loading rules (spec §4.3, S-07). Mock mode ignores the stored vectors and model.
 * Real mode applies loadVectors, so a real-mode deploy before P1's rollout step 2 (the real
 * index, P1 spec §7) fails loudly. P1 has no threshold rule: it has no similarity gate (P1 spec
 * §4, P-06).
 */
export function loadIndex(index: IndexFile, { mock }: { mock: boolean }): LoadedIndex {
  if (mock) return { mock: true, chunks: index.chunks.map(toChunk) };
  return { mock: false, ...loadVectors(index) };
}

/** The last loading rule, applied at query time (spec §4.3): the route answers with its error. */
export function checkQueryDimensions(embedding: readonly number[], dimensions: number): void {
  if (embedding.length !== dimensions) {
    throw new Error(
      `The query embedding has ${embedding.length} dimensions; the index has ${dimensions}`,
    );
  }
}
