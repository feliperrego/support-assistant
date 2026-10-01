/**
 * Where the help center's articles live, relative to the repo root (spec §3). Its own pure
 * module, so lib/rag/config.ts can name it without pulling node:fs into the client bundle, where
 * the citation checker runs (spec §1 item 2).
 */
export const HELP_CENTER_DIR = "content/help-center";
