import { DocsArticle } from "@/features/docs/components/docs-article";
import { docMetadata } from "@/features/docs/metadata";
import { team } from "@/features/docs/pages/team";

export const metadata = docMetadata(team);

export default function Page() {
  return <DocsArticle page={team} />;
}
