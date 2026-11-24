import { DocsArticle } from "@/features/docs/components/docs-article";
import { docMetadata } from "@/features/docs/metadata";
import { faq } from "@/features/docs/pages/faq";

export const metadata = docMetadata(faq);

export default function Page() {
  return <DocsArticle page={faq} />;
}
