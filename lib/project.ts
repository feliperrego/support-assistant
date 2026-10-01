/**
 * The project's identity (template spec §9 step 6), in one file: these four values and the
 * package.json `name` (which must equal PROJECT_SLUG; see project.test.ts). The layout metadata,
 * the footer's repo link, the page's h1, the rate-limit key prefix and the locale storage key all
 * read from here. Pure and client-safe.
 */

/**
 * Shown as the page title and the header's h1. It stays untranslated. The store is fictional; its
 * name was checked against real companies (spec §3).
 */
export const PRODUCT_NAME = "Acme Outfitters Support";

/** The layout's meta description, for browser tabs and link previews (spec §1). */
export const PRODUCT_DESCRIPTION =
  "Support-desk demo for a fictional outdoor-gear store: cited help-center answers, order lookups and hand-offs to a human. By Felipe Rêgo.";

/** The repo name (spec §10, P-02). Also namespaces the rate-limit counters and the stored locale. */
export const PROJECT_SLUG = "support-assistant";

export const REPO_URL = "https://github.com/feliperrego/support-assistant";
