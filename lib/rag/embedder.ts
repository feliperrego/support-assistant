// Copied from rag-citations (#2) lib/rag/embedder.ts unchanged (spec §4). "spec" in the comments below
// means the rag-citations spec, and R-nn/S-nn are its decisions.
import { createHash } from "node:crypto";
import type { EmbeddingModel } from "ai";
import { MockEmbeddingModelV4 } from "ai/test";
import type { LoadedIndex } from "./index-file";

/** Large enough that two words of one passage rarely share a slot. */
export const MOCK_EMBEDDING_DIMENSIONS = 4096;

// Shorter words are dropped, which removes most function words (a, I, do, in, my) without a
// stop list, so the score follows the content words a question shares with a passage.
const MIN_WORD_LENGTH = 3;

/** The mock embedder's words: lower-cased runs of letters and digits, 3 or more long. */
export function mockWords(text: string): string[] {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.filter((word) => word.length >= MIN_WORD_LENGTH);
}

/**
 * Feature hashing (spec §10, S-27): each occurrence of a word adds 1 or -1 at a slot, both
 * picked by the SHA-256 of the word, so the cosine of two vectors follows the words the texts
 * share. The random sign makes the rare collisions cancel out on average instead of adding up.
 */
export function mockEmbedding(text: string): number[] {
  const vector = new Array<number>(MOCK_EMBEDDING_DIMENSIONS).fill(0);
  for (const word of mockWords(text)) {
    const digest = createHash("sha256").update(word).digest();
    vector[digest.readUInt32LE(0) % MOCK_EMBEDDING_DIMENSIONS] += digest[4] & 1 ? -1 : 1;
  }
  return vector;
}

/**
 * The mock embedding model (spec §10). MockEmbeddingModelV4 defaults to 1 value per call, no
 * parallel calls and a doEmbed that throws, so all three are set.
 */
export function createMockEmbeddingModel(): MockEmbeddingModelV4 {
  return new MockEmbeddingModelV4({
    // The Gateway's limit (spec §4.2), so the whole mock index is one call, as in real mode.
    maxEmbeddingsPerCall: 2048,
    supportsParallelCalls: true,
    doEmbed: async ({ values }) => ({ embeddings: values.map(mockEmbedding), warnings: [] }),
  });
}

/**
 * The model that embeds questions: the mock in mock mode (R-19), otherwise the index's own model
 * id, which embed() sends to the AI Gateway (spec §5 step 4, S-18).
 */
export function getEmbeddingModel(index: LoadedIndex): EmbeddingModel {
  return index.mock ? createMockEmbeddingModel() : index.model;
}
