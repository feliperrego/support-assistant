import { ArticleIndex } from "@/components/help-center/article-index";
import { readHelpCenter } from "@/lib/help-center/articles";
import { articleGroups } from "@/lib/help-center/blocks";

/** The Help Center's index (spec §1, item 5), read from content/help-center at build time. */
export default function HelpCenter() {
  return <ArticleIndex groups={articleGroups(readHelpCenter())} />;
}
