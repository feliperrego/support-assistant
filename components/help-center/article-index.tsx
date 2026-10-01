"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useLocale } from "@/components/i18n/locale-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ArticleGroup } from "@/lib/help-center/blocks";

/**
 * The Help Center's index (spec §1, item 5): the articles the assistant answers from, by
 * category. The articles are English only (P-11), so their titles and categories are marked
 * lang="en"; the page's own text is translated.
 */
export function ArticleIndex({ groups }: { groups: readonly ArticleGroup[] }) {
  const { t } = useLocale();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">{t.helpCenter.title}</h2>
        <p className="text-muted-foreground">
          {t.helpCenter.intro} {t.helpCenter.englishNote}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.category} size="sm">
            <CardHeader>
              <CardTitle>
                <h3 lang="en">{group.category}</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-1">
                {group.articles.map((article) => (
                  <li key={article.id}>
                    <Link
                      href={`/help-center/${article.id}`}
                      lang="en"
                      className="inline-flex items-center gap-2 underline-offset-4 hover:underline pointer-coarse:min-h-11"
                    >
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      {article.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
