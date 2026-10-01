import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// Interface text comes from the dictionaries in lib/i18n/ (X-01 design §4.2, §4.4). The rule
// sees JSX text only; attributes and strings outside JSX are left to review and the e2e suites.
const eslint = new ESLint({ cwd: process.cwd() });

async function jsxLiteralMessages(code: string, file: string) {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(process.cwd(), file),
  });
  return result.messages.filter((m) => m.ruleId === "react/jsx-no-literals");
}

const LITERAL = "export function X() {\n  return <p>Hello there</p>;\n}\n";

describe("JSX literals", () => {
  it.each(["components/x.tsx", "components/chat/x.tsx", "components/i18n/x.tsx"])(
    "are rejected in %s",
    async (file) => {
      expect(await jsxLiteralMessages(LITERAL, file)).toHaveLength(1);
    },
    30_000,
  );

  it.each(["components/ui/x.tsx", "app/x.tsx"])(
    "are allowed in %s",
    async (file) => {
      expect(await jsxLiteralMessages(LITERAL, file)).toHaveLength(0);
    },
    30_000,
  );

  it("allow the language labels and the author name in components", async () => {
    const code = [
      "export function X() {",
      "  return (",
      "    <p>",
      "      <span>EN</span>",
      "      <span>PT</span>",
      '      <a href="https://feliperrego.com">Felipe Rêgo</a>',
      "    </p>",
      "  );",
      "}",
      "",
    ].join("\n");
    expect(await jsxLiteralMessages(code, "components/x.tsx")).toHaveLength(0);
  }, 30_000);

  it("allow text read from a dictionary", async () => {
    const code = "export function X({ t }: { t: { a: string } }) {\n  return <p>{t.a}</p>;\n}\n";
    expect(await jsxLiteralMessages(code, "components/x.tsx")).toHaveLength(0);
  }, 30_000);
});
