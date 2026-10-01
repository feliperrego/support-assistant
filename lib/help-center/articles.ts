import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { HELP_CENTER_DIR } from "./dir";

/**
 * The help center of spec §3: about 15 English Markdown articles written for the demo, one file
 * per article, split into "##" sections so #2's chunker applies (spec §4). Relative to the repo
 * root. Server-only: it reads the files from disk.
 */
export { HELP_CENTER_DIR };

const ARTICLE_EXTENSION = ".md";

/** One article. Its id is the file name without ".md", the gold of a policy ticket (spec §5). */
export type Article = {
  id: string;
  /** The file name inside HELP_CENTER_DIR, such as "returns.md". */
  file: string;
  title: string;
  /** The Help Center's group for the article (spec §1, item 5). */
  category: string;
  /** The whole file, frontmatter included, as #2's chunker reads it. */
  content: string;
};

/** The frontmatter's `key: value` lines; a value may sit in matching quotes. */
function readFrontmatter(file: string, content: string): Record<string, string> {
  const lines = content.split("\n");
  const close = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
  if (close === -1) throw new Error(`${file} has no frontmatter`);
  const fields: Record<string, string> = {};
  for (const line of lines.slice(1, close)) {
    const match = /^([a-z]+):\s*(.*)$/.exec(line);
    if (match) fields[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return fields;
}

/** Parses one article file; throws when its title or category is missing. */
export function parseArticle(file: string, content: string): Article {
  const { title, category } = readFrontmatter(file, content);
  if (!title) throw new Error(`${file} has no frontmatter title`);
  if (!category) throw new Error(`${file} has no frontmatter category`);
  return { id: path.basename(file, ARTICLE_EXTENSION), file, title, category, content };
}

/** Reads the .md files directly inside `dir`, sorted by file name in code-unit order. */
export function readHelpCenter(dir: string = HELP_CENTER_DIR): Article[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(ARTICLE_EXTENSION))
    .map((entry) => entry.name)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((file) => parseArticle(file, readFileSync(path.join(dir, file), "utf8")));
}
