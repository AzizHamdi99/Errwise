import { DocsArticle } from "@/features/docs/components/docs-article";
import { docMetadata } from "@/features/docs/metadata";
import { apiReference } from "@/features/docs/pages/api-reference";

export const metadata = docMetadata(apiReference);

export default function Page() {
  return <DocsArticle page={apiReference} />;
}
