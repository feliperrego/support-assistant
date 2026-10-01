/**
 * Retrieval settings (spec §4), adapted from rag-citations (#2) lib/rag/config.ts. P1 has no
 * pinned upstream corpus, so #2's corpus tag and commit are gone, and no similarity gate
 * (spec §4, P-06), so its refusal thresholds are gone too.
 */

/** The help center the index is built from (spec §3). */
export { HELP_CENTER_DIR } from "@/lib/help-center/dir";

/** A ## section longer than this many whitespace-separated words is split at its ### (#2, S-25). */
export const MAX_SECTION_WORDS = 1500;

/**
 * The index built from the help center (spec §4), shipped with the chat route. Mock mode
 * (CI, the e2e tests, Preview) commits an index without vectors; the real one is built at
 * rollout step 2 (spec §7).
 */
export const INDEX_PATH = "content/help-center-index.json";

/** Passages retrieved per message (spec §4: top 5, as #2). */
export const K = 5;
