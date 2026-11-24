import { DocsArticle } from "@/features/docs/components/docs-article";
import { docMetadata } from "@/features/docs/metadata";
import { integrations } from "@/features/docs/pages/integrations";

export const metadata = docMetadata(integrations);

export default function Page() {
  return <DocsArticle page={integrations} />;
}
