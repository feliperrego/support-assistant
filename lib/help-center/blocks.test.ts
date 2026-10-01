import { describe, expect, it } from "vitest";
import { readIndexFile } from "@/lib/rag/index-file";
import { parseArticle, readHelpCenter } from "./articles";
import { articleBlocks, articleGroups, sectionIds } from "./blocks";

// The Help Center article pages (spec §1, item 5): the article as blocks, each "##" section with
// the anchor a citation links to.

const SAMPLE = [
  "---",
  "title: Sample",
  "category: Testing",
  "---",
  "",
  "An intro that wraps",
  "onto a second line.",
  "",
  "## First section",
  "",
  "One paragraph.",
  "",
  "- an item",
  "- another item",
  "",
  "## Second, with punctuation!",
  "",
  "Last paragraph.",
  "",
].join("\n");

describe("articleBlocks", () => {
  it("reads the intro, the ## sections, paragraphs and lists, joining wrapped lines", () => {
    expect(articleBlocks(parseArticle("sample.md", SAMPLE))).toEqual([
      { type: "paragraph", text: "An intro that wraps onto a second line." },
      { type: "heading", id: "first-section", text: "First section" },
      { type: "paragraph", text: "One paragraph." },
      { type: "list", items: ["an item", "another item"] },
      { type: "heading", id: "second-with-punctuation", text: "Second, with punctuation!" },
      { type: "paragraph", text: "Last paragraph." },
    ]);
  });

  it("gives a repeated heading the chunker's unique slug", () => {
    const content = SAMPLE.replace("## Second, with punctuation!", "## First section");
    const ids = articleBlocks(parseArticle("sample.md", content)).flatMap((block) =>
      block.type === "heading" ? [block.id] : [],
    );
    expect(ids).toEqual(["first-section", "first-section-1"]);
  });

  it("renders every line of every article as a block: nothing is dropped", () => {
    for (const article of readHelpCenter()) {
      const words = (text: string) => text.match(/[\p{L}\p{N}$%°]+/gu) ?? [];
      const body = article.content.split("\n---\n").slice(1).join("\n---\n");
      const shown = articleBlocks(article)
        .map((block) => (block.type === "list" ? block.items.join(" ") : block.text))
        .join(" ");
      expect(words(shown), article.id).toEqual(words(body));
    }
  });
});

describe("section anchors", () => {
  it("every passage of the committed index links to an article page and a section on it", () => {
    const articles = new Map(readHelpCenter().map((article) => [article.id, article]));
    for (const chunk of readIndexFile().chunks) {
      const [article, section] = chunk.id.split("#");
      expect(articles.has(article), chunk.id).toBe(true);
      if (section !== undefined) {
        expect(sectionIds(articles.get(article)!), chunk.id).toContain(section);
      }
    }
  });
});

describe("articleGroups", () => {
  it("lists every article once, by category then title, both in alphabetical order", () => {
    const articles = readHelpCenter();
    const groups = articleGroups(articles);
    const listed = groups.flatMap((group) => group.articles.map(({ id }) => id));
    expect([...listed].sort()).toEqual(articles.map(({ id }) => id).sort());
    expect(groups.map(({ category }) => category)).toEqual(
      [...new Set(articles.map(({ category }) => category))].sort(),
    );
    for (const group of groups) {
      const titles = group.articles.map(({ title }) => title);
      expect(titles).toEqual([...titles].sort());
    }
  });
});
