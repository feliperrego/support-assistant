// Copied from rag-citations (#2) lib/rag/chunk.test.ts (spec §6: #2's copied tests); only ".mdx"
// file names became ".md", the help center's extension. "spec" below means the rag-citations spec.
import { describe, expect, it } from "vitest";
import { type Chunk, chunkCorpus, chunkFile, countWords } from "./chunk";
import { MAX_SECTION_WORDS } from "./config";
import type { CorpusFile } from "./corpus";

const FRONTMATTER = ["---", "title: Embeddings", "description: Learn how to embed values.", "---"];

/** A corpus file with the corpus's 4-line frontmatter, so its body starts at line 5. */
function mdx(...body: string[]): CorpusFile {
  return { file: "30-embeddings.md", content: [...FRONTMATTER, ...body].join("\n") + "\n" };
}

/** `n` whitespace-separated words on one line. */
function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
}

/** Each chunk as [id, heading, startLine, endLine]. */
function outline(chunks: Chunk[]): [string, string, number, number][] {
  return chunks.map(({ id, heading, startLine, endLine }) => [id, heading, startLine, endLine]);
}

describe("chunkFile", () => {
  it("makes the text before the first ## the intro chunk, headed by the frontmatter title", () => {
    const chunks = chunkFile(mdx("", "# Embeddings", "", "Vectors.", "", "## Settings", "Text."));
    expect(outline(chunks)).toEqual([
      ["30-embeddings", "Embeddings", 5, 9],
      ["30-embeddings#settings", "Embeddings › Settings", 10, 11],
    ]);
    expect(chunks[0].text).toBe("\n# Embeddings\n\nVectors.\n");
  });

  it("keeps the raw lines, frontmatter excluded and nothing else changed", () => {
    const body = [
      "# Embeddings",
      "<Note>Use `embedMany` for **many** values.</Note>",
      "## Settings  ",
      "See [the reference](/docs/reference).",
      "```ts",
      "import { embed } from 'ai';",
      "```",
    ];
    const chunks = chunkFile(mdx(...body));
    expect(chunks.map((chunk) => chunk.text)).toEqual([
      body.slice(0, 2).join("\n"),
      body.slice(2).join("\n"),
    ]);
  });

  it("starts a chunk at each ## heading, not at #, ### or ####", () => {
    const chunks = chunkFile(
      mdx("# Embeddings", "## One", "### Sub", "#### Deep", "## Two", "# Title again"),
    );
    expect(outline(chunks)).toEqual([
      ["30-embeddings", "Embeddings", 5, 5],
      ["30-embeddings#one", "Embeddings › One", 6, 8],
      ["30-embeddings#two", "Embeddings › Two", 9, 10],
    ]);
  });

  it("reads ## headings as CommonMark does", () => {
    const chunks = chunkFile(
      mdx("## Closed ##", "##NoSpace", "    ## Four spaces", "   ## Three spaces", "Text."),
    );
    expect(outline(chunks)).toEqual([
      ["30-embeddings#closed", "Embeddings › Closed", 5, 7],
      ["30-embeddings#three-spaces", "Embeddings › Three spaces", 8, 9],
    ]);
  });

  it.each([
    ["a backtick fence", ["```md", "## Not a section", "```"]],
    ["a tilde fence", ["~~~md", "## Not a section", "~~~"]],
    ["a fence that a shorter run cannot close", ["````md", "```", "## Not a section", "````"]],
    ["a tilde fence that a backtick run cannot close", ["~~~", "```", "## Not a section", "~~~"]],
    ["a fence whose closing run has text after it", ["```", "``` ts", "## Not a section", "```"]],
    ["a fence indented inside JSX", ["<Tab>", "    ```md", "  ## Not a section", "    ```"]],
    ["an unclosed fence, which runs to the end of the file", ["```ts", "## Not a section"]],
  ])("keeps %s inside its section", (_, code) => {
    const chunks = chunkFile(mdx("## Example", ...code, "Text."));
    expect(outline(chunks)).toEqual([
      ["30-embeddings#example", "Embeddings › Example", 5, 6 + code.length],
    ]);
  });

  it("does not open a fence on a backtick run whose info string has a backtick", () => {
    const chunks = chunkFile(mdx("## Example", "```inline``` code", "## Next"));
    expect(chunks.map((chunk) => chunk.id)).toEqual([
      "30-embeddings#example",
      "30-embeddings#next",
    ]);
  });

  it("gives each chunk an id from the file name and a slug of its heading", () => {
    const chunks = chunkFile(
      mdx("## `embedMany`", "## Handling errors (with `error` support)", "## Provider & Model"),
    );
    expect(chunks.map((chunk) => chunk.id)).toEqual([
      "30-embeddings#embedmany",
      "30-embeddings#handling-errors-with-error-support",
      "30-embeddings#provider--model",
    ]);
    expect(chunks[0].heading).toBe("Embeddings › `embedMany`");
  });

  it("adds a numeric suffix when a slug is already taken in the file", () => {
    const chunks = chunkFile(mdx("## Example", "## Example 1", "## Example"));
    expect(chunks.map((chunk) => chunk.id)).toEqual([
      "30-embeddings#example",
      "30-embeddings#example-1",
      "30-embeddings#example-2",
    ]);
  });

  it("names the intro chunk after the file alone", () => {
    const { content } = mdx("# AI SDK Core", "## Guides");
    expect(chunkFile({ file: "index.md", content }).map((chunk) => chunk.id)).toEqual([
      "index",
      "index#guides",
    ]);
  });

  it("skips an intro that holds only blank lines", () => {
    expect(outline(chunkFile(mdx("", "", "## Settings", "Text.")))).toEqual([
      ["30-embeddings#settings", "Embeddings › Settings", 7, 8],
    ]);
  });

  it("makes a file without ## headings a single intro chunk", () => {
    expect(outline(chunkFile(mdx("# Embeddings", "### Only a sub", "Text.")))).toEqual([
      ["30-embeddings", "Embeddings", 5, 7],
    ]);
  });

  it("ends the last chunk at the last line, with or without a final newline", () => {
    const withNewline = mdx("## Settings", "Last line.");
    const without = { ...withNewline, content: withNewline.content.slice(0, -1) };
    expect(chunkFile(without)).toEqual(chunkFile(withNewline));
    expect(chunkFile(without)[0]).toMatchObject({ endLine: 6, text: "## Settings\nLast line." });
  });

  it("reads a quoted frontmatter title", () => {
    const content = '---\ntitle: "Provider & Model Management"\n---\n## Registry\n';
    expect(chunkFile({ file: "45-provider-management.md", content })[0].heading).toBe(
      "Provider & Model Management › Registry",
    );
  });

  it.each([
    ["no frontmatter", "# Embeddings\n## Settings\n"],
    ["no title in the frontmatter", "---\ndescription: Embeddings.\n---\n## Settings\n"],
    ["an unclosed frontmatter", "---\ntitle: Embeddings\n## Settings\n"],
  ])("fails on a file with %s", (_, content) => {
    expect(() => chunkFile({ file: "30-embeddings.md", content })).toThrow(
      "30-embeddings.md has no frontmatter title",
    );
  });
});

describe("a section longer than MAX_SECTION_WORDS", () => {
  it("is split at its ### headings, the text before the first ### being its own chunk", () => {
    const half = words(MAX_SECTION_WORDS / 2);
    const chunks = chunkFile(
      mdx("# Embeddings", "## Settings", "Lead.", "### Retries", half, "### Parallel Calls", half),
    );
    expect(outline(chunks)).toEqual([
      ["30-embeddings", "Embeddings", 5, 5],
      ["30-embeddings#settings", "Embeddings › Settings", 6, 7],
      ["30-embeddings#retries", "Embeddings › Settings › Retries", 8, 9],
      ["30-embeddings#parallel-calls", "Embeddings › Settings › Parallel Calls", 10, 11],
    ]);
  });

  it("is split only when longer than MAX_SECTION_WORDS", () => {
    // "## Settings" and "### Retries" are 4 words.
    const section = (n: number) => mdx("## Settings", "### Retries", words(n));
    expect(chunkFile(section(MAX_SECTION_WORDS - 4))).toHaveLength(1);
    expect(chunkFile(section(MAX_SECTION_WORDS - 3))).toHaveLength(2);
  });

  it("counts the words inside fenced code", () => {
    const chunks = chunkFile(
      mdx("## Settings", "```ts", words(MAX_SECTION_WORDS), "```", "### Retries", "Text."),
    );
    expect(outline(chunks)).toEqual([
      ["30-embeddings#settings", "Embeddings › Settings", 5, 8],
      ["30-embeddings#retries", "Embeddings › Settings › Retries", 9, 10],
    ]);
  });

  it("keeps a ### subsection that is still longer whole", () => {
    const chunks = chunkFile(
      mdx("## Settings", "### Retries", words(MAX_SECTION_WORDS + 1), "More.", "### Other"),
    );
    expect(outline(chunks)).toEqual([
      ["30-embeddings#settings", "Embeddings › Settings", 5, 5],
      ["30-embeddings#retries", "Embeddings › Settings › Retries", 6, 8],
      ["30-embeddings#other", "Embeddings › Settings › Other", 9, 9],
    ]);
  });

  it("stays whole when it has no ### heading outside fenced code", () => {
    const chunks = chunkFile(
      mdx("## Settings", words(MAX_SECTION_WORDS + 1), "```md", "### Not a heading", "```"),
    );
    expect(outline(chunks)).toEqual([["30-embeddings#settings", "Embeddings › Settings", 5, 9]]);
  });

  it("shares the file's slugs, so a repeated one gets a suffix", () => {
    const chunks = chunkFile(
      mdx("## Retries", "## Settings", "### Retries", words(MAX_SECTION_WORDS + 1)),
    );
    expect(chunks.map((chunk) => chunk.id)).toEqual([
      "30-embeddings#retries",
      "30-embeddings#settings",
      "30-embeddings#retries-1",
    ]);
  });

  it("never applies to the intro, which is not a ## section", () => {
    const chunks = chunkFile(mdx("# Embeddings", words(MAX_SECTION_WORDS + 1), "### Sub", "Text."));
    expect(outline(chunks)).toEqual([["30-embeddings", "Embeddings", 5, 8]]);
  });
});

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("  ## Settings\n\n`maxRetries`:\tnumber  ")).toBe(4);
    expect(countWords(" \n\t")).toBe(0);
  });
});

describe("chunkCorpus", () => {
  it("chunks each file in the given order", () => {
    const index = { file: "index.md", content: "---\ntitle: AI SDK Core\n---\n## Settings\n" };
    expect(chunkCorpus([mdx("## Settings"), index]).map((chunk) => chunk.id)).toEqual([
      "30-embeddings#settings",
      "index#settings",
    ]);
  });
});
