import { ArticleSections } from "@/components/shared/article/article-sections";
import { TableOfContents } from "@/components/shared/article/table-of-contents";
import type { ArticleSection } from "@/components/shared/article/types";

interface Props {
  title: string;
  updated: string;
  intro: string;
  sections: ArticleSection[];
}

export function LegalArticle({ title, updated, intro, sections }: Props) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:gap-16">
      <article className="min-w-0 max-w-3xl">
        <header className="mb-12 space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {updated}
          </p>
          <p className="text-lg leading-relaxed text-muted-foreground">
            {intro}
          </p>
        </header>
        <ArticleSections sections={sections} />
      </article>
      <aside className="hidden lg:block">
        <div className="sticky top-16 max-h-[calc(100svh-4rem)] overflow-y-auto py-10">
          <TableOfContents
            items={sections.map(({ id, title: text }) => ({ id, title: text }))}
          />
        </div>
      </aside>
    </div>
  );
}
