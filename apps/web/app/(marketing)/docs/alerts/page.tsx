import { DocsArticle } from "@/features/docs/components/docs-article";
import { docMetadata } from "@/features/docs/metadata";
import { alerts } from "@/features/docs/pages/alerts";

export const metadata = docMetadata(alerts);

export default function Page() {
  return <DocsArticle page={alerts} />;
}
