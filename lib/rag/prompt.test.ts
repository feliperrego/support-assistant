// Adapted from rag-citations (#2) lib/rag/prompt.test.ts: the passage blocks and their reader
// are #2's; P1's own rules live in lib/chat/instructions.ts (spec §4).
import { describe, expect, it } from "vitest";
import { readIndexFile } from "./index-file";
import { formatPassages, readPassages } from "./prompt";

describe("formatPassages", () => {
  it("numbers the passages from 1, each exactly as its text, separated by blank lines", () => {
    expect(formatPassages(["\nFirst passage.\n", "## Second\n\nText"])).toBe(
      [
        '<passage number="1">\n\nFirst passage.\n\n</passage>',
        '<passage number="2">\n## Second\n\nText\n</passage>',
      ].join("\n\n"),
    );
  });

  it("is empty for no passages", () => {
    expect(formatPassages([])).toBe("");
  });
});

describe("readPassages", () => {
  it("returns no passages for text without any", () => {
    expect(readPassages("Answer from the help center.")).toEqual([]);
  });

  // The chat mock reads the passages back from the instructions it receives (spec §4).
  it("reads back every committed chunk's text exactly, five at a time, inside other text", () => {
    const texts = readIndexFile().chunks.map((chunk) => chunk.text);
    expect(texts.length).toBeGreaterThan(0);
    for (let i = 0; i < texts.length; i += 5) {
      const passages = texts.slice(i, i + 5);
      const instructions = `Rules.\n\n${formatPassages(passages)}\n\nInterface language: English.`;
      expect(readPassages(instructions)).toEqual(passages);
    }
  });
});
