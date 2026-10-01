/**
 * The chat's limits (X-01 design §4.2). Project-owned: each project sets them in its own spec
 * (template spec §5.1). The client, the route's validation and the model call all read them from
 * here. Pure and client-safe.
 */

/** Output cap of every streamText call: the cost bound of one answer (template spec §5.1). */
export const MAX_OUTPUT_TOKENS = 1024;

/**
 * Most messages in one conversation, counted as the raw messages.length. The client stops at it
 * and the route rejects one more (X-01 design §4.3).
 */
export const MAX_MESSAGES = 20;

/**
 * Longest assistant text the route passes back to the model, in characters; a longer one is cut
 * to its end (lib/chat/validate.ts). Sized from MAX_OUTPUT_TOKENS: an honest answer at the token
 * cap usually fits, and a forged history cannot carry much more (limits.test.ts ties the two).
 */
export const MAX_ASSISTANT_CHARS = 6000;
