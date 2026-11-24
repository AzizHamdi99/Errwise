import { DocsArticle } from "@/features/docs/components/docs-article";
import { docMetadata } from "@/features/docs/metadata";
import { github } from "@/features/docs/pages/github";

export const metadata = docMetadata(github);

export default function Page() {
  return <DocsArticle page={github} />;
}
