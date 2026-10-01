// Copied from rag-citations (#2) lib/rag/corpus.ts (spec §4). The one change: readCorpus reads the
// help center's ".md" files instead of ".mdx". "spec" in the comments below means the
// rag-citations spec.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** One unmodified corpus file (spec §3): its name inside the corpus directory and its text. */
export type CorpusFile = { file: string; content: string };

// Fatal, so every string re-encodes to the file's exact bytes; ignoreBOM keeps a BOM as text.
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/** Code-unit order, so the order never depends on the machine's locale. */
function byFile(a: CorpusFile, b: CorpusFile): number {
  return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function decode(dir: string, file: string): string {
  try {
    return utf8.decode(readFileSync(path.join(dir, file)));
  } catch (cause) {
    throw new TypeError(`${file} is not valid UTF-8`, { cause });
  }
}

/** Reads the .md files directly inside `dir`, sorted by file name. */
export function readCorpus(dir: string): CorpusFile[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => ({ file: entry.name, content: decode(dir, entry.name) }))
    .sort(byFile);
}

/**
 * Each file's SHA-256 in `sha256sum` format ("<hex>  <file>\n"), sorted by file name. It is
 * committed as corpus/SHA256SUMS, which `shasum -a 256 -c` checks against the files.
 */
export function corpusManifest(files: readonly CorpusFile[]): string {
  const sorted = [...files].sort(byFile);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].file === sorted[i - 1].file) {
      throw new RangeError(`Duplicate corpus file: ${sorted[i].file}`);
    }
  }
  return sorted.map(({ file, content }) => `${sha256(content)}  ${file}\n`).join("");
}

/**
 * The hash of the sorted corpus files recorded in corpus/index.json (spec §4.2): the SHA-256
 * of their manifest, so `shasum -a 256 corpus/SHA256SUMS` prints the same value.
 */
export function corpusHash(files: readonly CorpusFile[]): string {
  return sha256(corpusManifest(files));
}
