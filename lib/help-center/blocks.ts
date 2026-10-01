import { chunkFile } from "@/lib/rag/chunk";
import type { Article } from "./articles";

/**
 * A Help Center article as the page renders it (spec §1, item 5): paragraphs, "- " lists and the
 * "##" sections, each with the anchor its passages link to (lib/rag/message.ts helpCenterUrl). The
 * anchors come from #2's chunker itself, so a citation always lands on its section. The articles
 * hold plain prose and lists only (step 2's rule), so nothing else is parsed. Pure.
 */
export type ArticleBlock =
  | { type: "heading"; id: string; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

const SECTION = /^## (.*)$/;
const LIST_ITEM = /^- (.*)$/;

/** The section anchor of each heading line, 1-based, from the chunker's chunk ids. */
function anchorsByLine(article: Article): Map<number, string> {
  const anchors = new Map<number, string>();
  for (const chunk of chunkFile({ file: article.file, content: article.content })) {
    const [, section] = chunk.id.split("#");
    if (section !== undefined) anchors.set(chunk.startLine, section);
  }
  return anchors;
}

/** The article's body after the frontmatter, as blocks. */
export function articleBlocks(article: Article): ArticleBlock[] {
  const lines = article.content.split("\n");
  const close = lines[0] === "---" ? lines.indexOf("---", 1) : -1;
  const anchors = anchorsByLine(article);
  const blocks: ArticleBlock[] = [];
  // The lines of the paragraph or list being read.
  let paragraph: string[] = [];
  let items: string[] = [];

  const flush = () => {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    if (items.length > 0) blocks.push({ type: "list", items });
    paragraph = [];
    items = [];
  };

  for (let index = close + 1; index < lines.length; index++) {
    const line = lines[index].trim();
    const section = SECTION.exec(line);
    const item = LIST_ITEM.exec(line);
    if (line === "") {
      flush();
    } else if (section !== null) {
      flush();
      const id = anchors.get(index + 1);
      if (id === undefined) throw new Error(`${article.file}:${index + 1} has no section anchor`);
      blocks.push({ type: "heading", id, text: section[1].trim() });
    } else if (item !== null) {
      if (paragraph.length > 0) flush();
      items.push(item[1].trim());
    } else if (items.length > 0) {
      // A wrapped list item continues the last one.
      items[items.length - 1] += ` ${line}`;
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

/** The section anchors of an article, in order. */
export function sectionIds(article: Article): string[] {
  return articleBlocks(article).flatMap((block) => (block.type === "heading" ? [block.id] : []));
}

/** A category of the Help Center's index, with its articles. */
export type ArticleGroup = { category: string; articles: { id: string; title: string }[] };

/** The Help Center's index: categories, then their articles, each in alphabetical order. */
export function articleGroups(articles: readonly Article[]): ArticleGroup[] {
  const byCategory = new Map<string, ArticleGroup["articles"]>();
  for (const { id, title, category } of articles) {
    byCategory.set(category, [...(byCategory.get(category) ?? []), { id, title }]);
  }
  const alphabetical = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return [...byCategory.keys()].sort(alphabetical).map((category) => ({
    category,
    articles: byCategory.get(category)!.sort((a, b) => alphabetical(a.title, b.title)),
  }));
}
