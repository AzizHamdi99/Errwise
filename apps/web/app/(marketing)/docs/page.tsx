import { DocsArticle } from "@/features/docs/components/docs-article";
import { docMetadata } from "@/features/docs/metadata";
import { introduction } from "@/features/docs/pages/introduction";

export const metadata = {
  ...docMetadata(introduction),
  title: "Documentation",
};

export default function Page() {
  return <DocsArticle page={introduction} />;
}
