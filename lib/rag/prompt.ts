// The passage blocks of rag-citations (#2) lib/rag/prompt.ts (P1 spec §4). #2's own rules are
// replaced by P1's in lib/chat/instructions.ts; the numbering, which [n: "quote"] cites, is #2's.

// The passage text goes between the tags unchanged: it is the one passage string that
// data-sources carries and verifyQuote checks (#2, S-22).
const PASSAGE = /<passage number="(\d+)">\n([\s\S]*?)\n<\/passage>/g;

function formatPassage(text: string, index: number): string {
  return `<passage number="${index + 1}">\n${text}\n</passage>`;
}

/**
 * The numbered passages for the instructions, separated by blank lines. Passage n is
 * passages[n - 1], the numbering data-sources and verifyCitation use.
 */
export function formatPassages(passages: readonly string[]): string {
  return passages.map(formatPassage).join("\n\n");
}

/** The passage texts of instructions that hold formatPassages' blocks, in order. The mock quotes them. */
export function readPassages(instructions: string): string[] {
  return Array.from(instructions.matchAll(PASSAGE), (match) => match[2]);
}
