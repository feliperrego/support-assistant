"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import type { ArticleBlock } from "@/lib/help-center/blocks";

type Section = { id: string | null; heading: string | null; blocks: ArticleBlock[] };

/** The blocks under each heading: the intro first (no heading), then one section per "##". */
function sectionsOf(blocks: readonly ArticleBlock[]): Section[] {
  const sections: Section[] = [{ id: null, heading: null, blocks: [] }];
  for (const block of blocks) {
    if (block.type === "heading") sections.push({ id: block.id, heading: block.text, blocks: [] });
    else sections[sections.length - 1].blocks.push(block);
  }
  return sections.filter((section) => section.heading !== null || section.blocks.length > 0);
}

function Blocks({ blocks }: { blocks: readonly ArticleBlock[] }) {
  return blocks.map((block, i) =>
    block.type === "list" ? (
      <ul key={i} className="ml-5 list-disc space-y-1">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    ) : block.type === "paragraph" ? (
      <p key={i}>{block.text}</p>
    ) : null,
  );
}

type ArticleViewProps = { title: string; category: string; blocks: readonly ArticleBlock[] };

/**
 * One Help Center article (spec §1, item 5): plain text in "##" sections, each with the anchor its
 * citations link to (lib/help-center/blocks.ts). A section reached by its link is highlighted.
 * The article is English only (P-11), so it is marked lang="en"; the page's own text is
 * translated.
 */
export function ArticleView({ title, category, blocks }: ArticleViewProps) {
  const { t } = useLocale();
  const sections = sectionsOf(blocks);
  const anchored = sections.filter(
    (section): section is Section & { id: string; heading: string } => section.id !== null,
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <Link
        href="/help-center"
        className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground underline-offset-4 hover:underline pointer-coarse:min-h-11"
      >
        <ArrowLeft className="size-4" />
        {t.helpCenter.back}
      </Link>
      <div lang="en" className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{category}</p>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      {anchored.length > 1 && (
        <nav aria-label={t.helpCenter.contents} className="rounded-lg border px-4 py-3 text-sm">
          <p className="mb-1 font-medium">{t.helpCenter.contents}</p>
          <ul lang="en" className="flex flex-col gap-1">
            {anchored.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="underline-offset-4 hover:underline pointer-coarse:inline-block pointer-coarse:py-2.5"
                >
                  {section.heading}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <article lang="en" className="flex flex-col gap-6 leading-relaxed">
        {sections.map((section) =>
          section.id === null ? (
            <div key="intro" className="flex flex-col gap-3">
              <Blocks blocks={section.blocks} />
            </div>
          ) : (
            <section
              key={section.id}
              id={section.id}
              data-section={section.id}
              className="flex scroll-mt-4 flex-col gap-3 rounded-lg target:bg-amber-100/70 target:outline-8 target:outline-amber-100/70 dark:target:bg-amber-900/30 dark:target:outline-amber-900/30"
            >
              <h3 className="text-lg font-semibold">{section.heading}</h3>
              <Blocks blocks={section.blocks} />
            </section>
          ),
        )}
      </article>
    </div>
  );
}
