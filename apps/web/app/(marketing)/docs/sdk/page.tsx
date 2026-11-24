import { DocsArticle } from "@/features/docs/components/docs-article";
import { docMetadata } from "@/features/docs/metadata";
import { sdk } from "@/features/docs/pages/sdk";

export const metadata = docMetadata(sdk);

export default function Page() {
  return <DocsArticle page={sdk} />;
}
