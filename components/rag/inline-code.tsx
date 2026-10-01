// Copied from rag-citations (#2) components/rag/inline-code.tsx unchanged (P1 spec §4). "spec" in the
// comments below means the rag-citations spec, and R-nn/S-nn are its decisions.
import { Fragment } from "react";
import { parseCodeSpans } from "@/lib/rag/citations";

/** A code span's text, the minimal renderer's only markup (R-10). */
export function InlineCode({ children }: { children: string }) {
  return <code className="rounded-sm bg-muted px-1 py-0.5 font-mono text-[0.9em]">{children}</code>;
}

/** Text whose code spans render as <code>, such as the heading "Generating Text › `streamText`". */
export function TextWithCode({ text }: { text: string }) {
  return parseCodeSpans(text).map((segment, i) =>
    segment.type === "code" ? (
      <InlineCode key={i}>{segment.text}</InlineCode>
    ) : (
      <Fragment key={i}>{segment.text}</Fragment>
    ),
  );
}
