import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// The repo's files and imports, for the tests that guard the shell's boundaries (X-01 design §6).
// Paths are posix and relative to the repo root, as git prints them.

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** TypeScript and JavaScript sources. */
export const SOURCE_FILE = /\.[cm]?[jt]sx?$/;

/**
 * Every file of the repo: the tracked ones and the new ones git does not ignore, so a new file is
 * checked before it is staged. Files deleted from the working tree are left out.
 */
export function repoFiles(): string[] {
  const listed = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: ROOT, encoding: "utf8" },
  );
  return [...new Set(listed.split("\0"))]
    .filter((file) => file !== "" && existsSync(path.join(ROOT, file)))
    .sort();
}

export function readRepoFile(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8");
}

/**
 * The shell-owned files that stay in every project (X-01 design §4.1): i18n, the site header and
 * the footer. Every file under components/i18n/ is shell too.
 */
export const I18N_SHELL_FILES = [
  "components/i18n/language-switch.tsx",
  "components/i18n/locale-provider.tsx",
  "components/site-header.tsx",
  "components/footer.tsx",
  "lib/i18n/format.ts",
  "lib/i18n/locale.ts",
  "lib/i18n/shell-messages.ts",
];

/**
 * The shell-owned chat files (X-01 design §4.1), which the removal recipe deletes (X-01 design
 * §5). Every file under components/chat/ is shell too.
 */
export const CHAT_SHELL_FILES = [
  "components/chat/chat.tsx",
  "components/chat/composer.tsx",
  "components/chat/empty-state.tsx",
  "components/chat/message-list.tsx",
  "components/chat/plain-text-message.tsx",
  "hooks/use-stick-to-bottom.ts",
  "lib/chat/config.ts",
  "lib/chat/errors.ts",
  "lib/chat/ui.ts",
  "lib/chat/validate.ts",
];

const SHELL_FOLDERS = ["components/chat/", "components/i18n/"];

export function isShellFile(file: string): boolean {
  return (
    SHELL_FOLDERS.some((folder) => file.startsWith(folder)) ||
    I18N_SHELL_FILES.includes(file) ||
    CHAT_SHELL_FILES.includes(file)
  );
}

/**
 * The module specifiers a source imports: `import`, `export … from`, `import()` and `require()`.
 * TypeScript's own scanner reads them, so a comment or a string that mentions a path is not one.
 */
export function importSpecifiers(source: string): string[] {
  return ts.preProcessFile(source, true, true).importedFiles.map((reference) => reference.fileName);
}

const RESOLVED_ENDINGS = ["", ".ts", ".tsx", ".mts", ".js", ".mjs", "/index.ts", "/index.tsx"];

/**
 * The repo file an `@/…` or relative specifier points at, or null for a package. A path with no
 * file behind it is returned as written, so it is still checked by its folder.
 */
export function resolveImport(fromFile: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = specifier.slice(2);
  else if (specifier.startsWith(".")) {
    base = path.posix.join(path.posix.dirname(fromFile), specifier);
  } else return null;
  for (const ending of RESOLVED_ENDINGS) {
    const candidate = path.join(ROOT, base + ending);
    if (existsSync(candidate) && statSync(candidate).isFile()) return base + ending;
  }
  return base;
}

/** The repo files a source file imports, packages left out. */
export function localImports(file: string): string[] {
  return importSpecifiers(readRepoFile(file))
    .map((specifier) => resolveImport(file, specifier))
    .filter((target): target is string => target !== null);
}
