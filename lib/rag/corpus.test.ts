// Copied from rag-citations (#2) lib/rag/corpus.test.ts; ".mdx" became ".md", so the expected
// hashes were recomputed with shasum the same way.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { corpusHash, corpusManifest, readCorpus } from "./corpus";

// Hashes computed outside the code under test, with `shasum -a 256 a.md b.md`.
const A = { file: "a.md", content: "first\n" };
const B = { file: "b.md", content: "second\n" };
const MANIFEST =
  "b640e840b19d378660b32fb51ae18d67dccb4a8596a29e7bd72c1b2ae5928f41  a.md\n" +
  "480c2336b410f1ad5f8bf1b28944490255804b65350c527787e74ebdd511e3a4  b.md\n";
// `shasum -a 256` of that manifest saved as a file.
const HASH = "6c001e6da7e2bab3922ac53c72c31373d642a2f6b47a95b8089fe2a89795cbd4";

describe("corpusManifest", () => {
  it("lists each file's SHA-256 in sha256sum format, sorted by file name", () => {
    expect(corpusManifest([B, A])).toBe(MANIFEST);
  });
});

describe("corpusHash", () => {
  it("is the SHA-256 of the manifest", () => {
    expect(corpusHash([A, B])).toBe(HASH);
  });

  it("does not depend on the order of its input", () => {
    expect(corpusHash([B, A])).toBe(HASH);
  });

  it("changes when a file's content changes", () => {
    expect(corpusHash([A, { ...B, content: "second \n" }])).not.toBe(HASH);
    expect(corpusHash([A, { ...B, content: "second\r\n" }])).not.toBe(HASH);
  });

  it("changes when a file is renamed, added or removed", () => {
    expect(corpusHash([A, { ...B, file: "c.md" }])).not.toBe(HASH);
    expect(corpusHash([A, B, { file: "c.md", content: "" }])).not.toBe(HASH);
    expect(corpusHash([A])).not.toBe(HASH);
  });

  it("rejects two files with the same name, whose order would change the hash", () => {
    expect(() => corpusHash([A, { ...A, content: "other\n" }])).toThrow(RangeError);
  });
});

describe("readCorpus", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "corpus-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads only the .md files directly inside the directory", () => {
    writeFileSync(path.join(dir, "a.md"), "first\n");
    writeFileSync(path.join(dir, "notes.txt"), "not corpus\n");
    mkdirSync(path.join(dir, "nested.md"));
    writeFileSync(path.join(dir, "nested.md", "c.md"), "nested\n");
    expect(readCorpus(dir)).toEqual([{ file: "a.md", content: "first\n" }]);
  });

  it("sorts by file name in code-unit order, whatever the locale", () => {
    for (const file of ["index.md", "a.md", "Z.md", "10-b.md", "2-a.md"]) {
      writeFileSync(path.join(dir, file), file);
    }
    expect(readCorpus(dir).map((f) => f.file)).toEqual([
      "10-b.md",
      "2-a.md",
      "Z.md",
      "a.md",
      "index.md",
    ]);
  });

  it("keeps the bytes as they are: BOM, CRLF and a missing final newline", () => {
    const content = "﻿# Title\r\n\r\nNo final newline";
    writeFileSync(path.join(dir, "a.md"), content, "utf8");
    const [file] = readCorpus(dir);
    expect(file.content).toBe(content);
    expect(Buffer.from(file.content, "utf8")).toEqual(Buffer.from(content, "utf8"));
  });

  it("rejects a file that is not valid UTF-8, which could not be hashed as its bytes", () => {
    writeFileSync(path.join(dir, "a.md"), Buffer.from([0x61, 0xff, 0x62]));
    expect(() => readCorpus(dir)).toThrow(/a\.md is not valid UTF-8/);
  });
});
