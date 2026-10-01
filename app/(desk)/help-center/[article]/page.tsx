import { notFound } from "next/navigation";
import { ArticleView } from "@/components/help-center/article-view";
import { readHelpCenter } from "@/lib/help-center/articles";
import { articleBlocks } from "@/lib/help-center/blocks";

// One page per article, built at build time; any other id is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return readHelpCenter().map(({ id }) => ({ article: id }));
}

/**
 * One Help Center article (spec §1, item 5), with the section anchors its citations link to
 * (lib/rag/message.ts helpCenterUrl).
 */
export default async function Article({ params }: PageProps<"/help-center/[article]">) {
  const { article: id } = await params;
  const article = readHelpCenter().find((candidate) => candidate.id === id);
  if (article === undefined) notFound();
  return (
    <ArticleView
      title={article.title}
      category={article.category}
      blocks={articleBlocks(article)}
    />
  );
}
