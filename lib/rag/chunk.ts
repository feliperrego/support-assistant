// Copied from rag-citations (#2) lib/rag/chunk.ts (spec §4: chunking by "##" section). The one change:
// a file id drops ".md", the help center's extension, instead of ".mdx". "spec" in the comments below
// means the rag-citations spec, and R-nn/S-nn are its decisions.
import { MAX_SECTION_WORDS } from "./config";
import type { CorpusFile } from "./corpus";

/** One passage of the index (spec §4.1). */
export type Chunk = {
  /** "30-embeddings" for a file's intro, "30-embeddings#settings" for a section. */
  id: string;
  /** The corpus file, such as "30-embeddings.mdx". */
  file: string;
  /** The heading path from the frontmatter title, such as "Embeddings › Settings". */
  heading: string;
  /** The chunk's first file line, 1-based. */
  startLine: number;
  /** The chunk's last file line, 1-based and inclusive. */
  endLine: number;
  /** The one passage string (S-22): the raw lines startLine..endLine, joined by "\n". */
  text: string;
};

/** A chunk's lines as 0-based indexes, end excluded, and its headings below the title. */
type Part = { start: number; end: number; path: string[] };

type Heading = { index: number; level: 2 | 3; text: string };

const HEADING_SEPARATOR = " › ";

// CommonMark ATX heading: up to 3 spaces of indent, 1 to 6 "#", then a space or the line's end.
const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/;
// A fence may have any indent: MDX has no indented code, and JSX children are often indented.
const FENCE = /^[ \t]*(`{3,}|~{3,})(.*)$/;

/** Counts whitespace-separated words, the unit of MAX_SECTION_WORDS (spec §4.1). */
export function countWords(text: string): number {
  return text.match(/\S+/g)?.length ?? 0;
}

/** The file's lines without their "\n"; a final newline only ends the last line. */
function splitLines(content: string): string[] {
  const lines = content.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

/** The YAML frontmatter's title, and the index of the first line after the frontmatter. */
function readFrontmatter(file: string, lines: readonly string[]) {
  const close = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
  const frontmatter = close === -1 ? [] : lines.slice(1, close);
  const titleLine = frontmatter.find((line) => line.startsWith("title:"));
  // A plain YAML scalar, or one in matching quotes.
  const title = titleLine
    ?.slice("title:".length)
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2");
  if (!title) throw new Error(`${file} has no frontmatter title`);
  return { title, bodyStart: close + 1 };
}

/** CommonMark §4.5: a run of the fence's character, at least as long, alone on its line. */
function closesFence(fence: string, run: RegExpExecArray): boolean {
  return run[1][0] === fence[0] && run[1].length >= fence.length && run[2].trim() === "";
}

/** The ## and ### headings outside fenced code, so a chunk never splits code (spec §4.1). */
function findHeadings(lines: readonly string[], from: number): Heading[] {
  const headings: Heading[] = [];
  let fence: string | null = null;
  for (let index = from; index < lines.length; index++) {
    const run = FENCE.exec(lines[index]);
    if (fence !== null) {
      if (run !== null && closesFence(fence, run)) fence = null;
      continue;
    }
    // A backtick run whose info string holds a backtick is inline code, not a fence.
    if (run !== null && !(run[1][0] === "`" && run[2].includes("`"))) {
      fence = run[1];
      continue;
    }
    const match = ATX_HEADING.exec(lines[index]);
    const level = match?.[1].length;
    if (match !== null && (level === 2 || level === 3)) {
      // Drops an optional closing sequence, as in "## Settings ##".
      headings.push({ index, level, text: match[2].replace(/(?:^|[ \t]+)#+[ \t]*$/, "").trim() });
    }
  }
  return headings;
}

/**
 * One part per ## section, plus the intro before the first ## unless it is blank. A section
 * longer than MAX_SECTION_WORDS is split at its ### headings; a ### part stays whole (S-25).
 */
function splitParts(lines: readonly string[], bodyStart: number): Part[] {
  const headings = findHeadings(lines, bodyStart);
  const sections = headings.filter((heading) => heading.level === 2);
  const parts: Part[] = [];

  const introEnd = sections[0]?.index ?? lines.length;
  if (lines.slice(bodyStart, introEnd).some((line) => line.trim() !== "")) {
    parts.push({ start: bodyStart, end: introEnd, path: [] });
  }

  sections.forEach((section, i) => {
    const end = sections[i + 1]?.index ?? lines.length;
    const long = countWords(lines.slice(section.index, end).join("\n")) > MAX_SECTION_WORDS;
    const subsections = long
      ? headings.filter((sub) => sub.level === 3 && sub.index > section.index && sub.index < end)
      : [];
    parts.push({ start: section.index, end: subsections[0]?.index ?? end, path: [section.text] });
    subsections.forEach((sub, j) => {
      const subEnd = subsections[j + 1]?.index ?? end;
      parts.push({ start: sub.index, end: subEnd, path: [section.text, sub.text] });
    });
  });
  return parts;
}

/** A GitHub-style slug: lower case, punctuation dropped, each space a hyphen. */
export function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

/** The slug, or the first of slug-1, slug-2, … not yet taken. */
function uniqueSlug(slug: string, taken: Set<string>): string {
  let unique = slug;
  for (let n = 1; taken.has(unique); n++) unique = `${slug}-${n}`;
  taken.add(unique);
  return unique;
}

/** A corpus file's chunks, in document order (spec §4.1, R-03). */
export function chunkFile({ file, content }: CorpusFile): Chunk[] {
  const lines = splitLines(content);
  const { title, bodyStart } = readFrontmatter(file, lines);
  const stem = file.replace(/\.md$/, "");
  const taken = new Set<string>();

  return splitParts(lines, bodyStart).map(({ start, end, path }) => {
    const own = path.at(-1);
    return {
      id: own === undefined ? stem : `${stem}#${uniqueSlug(slugify(own), taken)}`,
      file,
      heading: [title, ...path].join(HEADING_SEPARATOR),
      startLine: start + 1,
      endLine: end,
      text: lines.slice(start, end).join("\n"),
    };
  });
}

/** Every file's chunks, in the order of the files. */
export function chunkCorpus(files: readonly CorpusFile[]): Chunk[] {
  return files.flatMap((file) => chunkFile(file));
}
