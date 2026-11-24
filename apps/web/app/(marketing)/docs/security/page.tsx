import { DocsArticle } from "@/features/docs/components/docs-article";
import { docMetadata } from "@/features/docs/metadata";
import { security } from "@/features/docs/pages/security";

export const metadata = docMetadata(security);

export default function Page() {
  return <DocsArticle page={security} />;
}
