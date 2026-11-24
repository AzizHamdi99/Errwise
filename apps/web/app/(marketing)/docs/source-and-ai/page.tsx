import { DocsArticle } from "@/features/docs/components/docs-article";
import { docMetadata } from "@/features/docs/metadata";
import { sourceAndAi } from "@/features/docs/pages/source-and-ai";

export const metadata = docMetadata(sourceAndAi);

export default function Page() {
  return <DocsArticle page={sourceAndAi} />;
}
