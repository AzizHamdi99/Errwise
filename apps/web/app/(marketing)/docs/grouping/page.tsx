import { DocsArticle } from "@/features/docs/components/docs-article";
import { docMetadata } from "@/features/docs/metadata";
import { grouping } from "@/features/docs/pages/grouping";

export const metadata = docMetadata(grouping);

export default function Page() {
  return <DocsArticle page={grouping} />;
}
