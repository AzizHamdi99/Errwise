import { DocsArticle } from "@/features/docs/components/docs-article";
import { docMetadata } from "@/features/docs/metadata";
import { quickstart } from "@/features/docs/pages/quickstart";

export const metadata = docMetadata(quickstart);

export default function Page() {
  return <DocsArticle page={quickstart} />;
}
