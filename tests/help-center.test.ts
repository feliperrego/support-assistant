import { describe, expect, it } from "vitest";
import { readHelpCenter, type Article } from "@/lib/help-center/articles";

// The help center of spec §3, checked apart from the code that will read it (spec §4, §6).
const articles = readHelpCenter();
const byId = new Map(articles.map((article) => [article.id, article]));

/** Text as a reader compares it: every dash a hyphen, whitespace collapsed. */
function plain(text: string): string {
  return text.replace(/\p{Pd}/gu, "-").replace(/\s+/g, " ");
}

/** The article without its frontmatter. */
function body({ content }: Article): string {
  const lines = content.split("\n");
  return lines.slice(lines.indexOf("---", 1) + 1).join("\n");
}

function article(id: string): Article {
  const found = byId.get(id);
  if (!found) throw new Error(`No article ${id}`);
  return found;
}

describe("content/help-center (spec §3)", () => {
  it("holds about 15 articles", () => {
    expect(articles.length).toBeGreaterThanOrEqual(12);
    expect(articles.length).toBeLessThanOrEqual(18);
  });

  it("names each file by a lower-case slug, the article's id", () => {
    for (const { id } of articles) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("gives each article its own title", () => {
    const titles = articles.map(({ title }) => title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("splits each article into ## sections with distinct headings, so #2's chunker applies (spec §4)", () => {
    for (const item of articles) {
      const lines = body(item).split("\n");
      const sections = lines.filter((line) => line.startsWith("## "));
      expect(sections.length, item.id).toBeGreaterThan(0);
      expect(new Set(sections).size, item.id).toBe(sections.length);
      // The frontmatter title is the article's only level-1 heading.
      expect(
        lines.filter((line) => /^#( |$)/.test(line)),
        item.id,
      ).toEqual([]);
      expect(item.content.endsWith("\n"), item.id).toBe(true);
    }
  });

  it("is plain prose and lists, so a quote matches the text a reader sees", () => {
    // #2's verifier reduces Markdown links to their text and leaves other syntax as it is
    // (rag-citations lib/rag/verify.ts): emphasis, code, HTML or a table would break a quote.
    for (const item of articles) {
      expect(body(item), item.id).not.toMatch(/[*_`<>|[\]]/);
    }
  });
});

// Each approved policy of spec §3 (P-03), in the words of the article that states it.
const POLICIES: [string, string][] = [
  ["shipping-options", "Standard shipping takes 5–7 business days."],
  ["shipping-options", "It is free on orders over $75"],
  ["shipping-options", "Express shipping takes 2 business days and costs $15"],
  ["returns", "You can return an item within 30 days of its delivery."],
  ["returns", "Items must be unused and with the tags still attached."],
  ["returns", "You pay for return shipping, unless the item is defective."],
  [
    "refunds",
    "We refund your original payment method within 5 business days of your return arriving",
  ],
  ["refunds", "Our support assistant can't grant refunds"],
  ["warranty", "covered for 1 year against manufacturing defects"],
  [
    "changing-or-canceling-an-order",
    "You can change the shipping address or the items in an order until your order ships.",
  ],
  ["changing-or-canceling-an-order", "the assistant passes your request to a member of the team"],
  ["resetting-your-password", "a self-service link to choose a new password"],
  ["managing-your-account", "Our support assistant never changes account details."],
];

describe("the policies of spec §3", () => {
  it.each(POLICIES)("%s states: %s", (id, phrase) => {
    expect(plain(body(article(id)))).toContain(plain(phrase));
  });
});

// Every duration and dollar amount the articles state. A new one, or a changed one, fails here
// until it is listed: the articles never contradict spec §3 by accident.
const DURATIONS = new Map([
  ["5-7 business days", "spec §3, standard shipping"],
  ["2 business days", "spec §3, express shipping; also the late-package threshold, beyond §3"],
  ["5 business days", "spec §3, refunds"],
  ["30 days", "spec §3, returns"],
  ["1 year", "spec §3, warranty"],
  ["1 business day", "beyond spec §3: the team's reply time"],
]);
const AMOUNTS = new Map([
  ["$75", "spec §3, free standard shipping"],
  ["$15", "spec §3, express shipping"],
]);

const UNIT = "(?:business days?|days?|weeks?|months?|years?|hours?|minutes?)";
const DIGIT_DURATION = new RegExp(`\\b\\d+(?:\\p{Pd}\\d+)?[ -]${UNIT}\\b`, "gu");
const WORD_DURATION = new RegExp(
  `\\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen|fifteen|twenty|thirty|forty|sixty|ninety)[ -]${UNIT}\\b`,
  "giu",
);

describe("the durations and amounts the articles state", () => {
  it("are only the listed durations, written in digits", () => {
    for (const item of articles) {
      const text = plain(body(item));
      expect(text.match(WORD_DURATION) ?? [], item.id).toEqual([]);
      for (const found of text.match(DIGIT_DURATION) ?? []) {
        // "1-year warranty" counts as "1 year".
        const duration = found.replace(/^(\d+(?:-\d+)?)-(?=\p{L})/u, "$1 ");
        expect(DURATIONS.has(duration), `${item.id}: ${found}`).toBe(true);
      }
    }
  });

  it("are only the listed dollar amounts, and no percentage", () => {
    for (const item of articles) {
      const text = body(item);
      for (const found of text.match(/\$[\d,.]*\d/g) ?? []) {
        expect(AMOUNTS.has(found), `${item.id}: ${found}`).toBe(true);
      }
      expect(text, item.id).not.toMatch(/\d\s*%|percent/i);
    }
  });
});
