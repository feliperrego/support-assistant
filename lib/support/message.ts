import type { InferUITools, UIMessage } from "ai";
import type { AnswerUsage, RagDataTypes } from "@/lib/rag/message";
import type { SupportTools } from "./tools";

/**
 * The chat's message type (spec §1, item 3; spec §4): the retrieved passages travel as a
 * data-sources part, the tool calls as tool parts, and the metadata carries what the Analysis
 * panel shows: the retrieval's best score and search time, then the answer's tokens and latency.
 */
export type SupportMetadata = {
  /** The best passage's cosine score and the in-memory search time, in milliseconds. */
  retrieval: { topScore: number; searchMs: number };
  /** The tokens of every model call of the answer, summed; sent with the finish chunk. */
  usage?: AnswerUsage;
  /**
   * The answer's time on the server, from the start of retrieval to the last model step, in
   * whole milliseconds; sent with the finish chunk.
   */
  latencyMs?: number;
};

export type SupportUIMessage = UIMessage<SupportMetadata, RagDataTypes, InferUITools<SupportTools>>;
