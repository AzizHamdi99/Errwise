import { DocsArticle } from "@/features/docs/components/docs-article";
import { docMetadata } from "@/features/docs/metadata";
import { regressions } from "@/features/docs/pages/regressions";

export const metadata = docMetadata(regressions);

export default function Page() {
  return <DocsArticle page={regressions} />;
}
