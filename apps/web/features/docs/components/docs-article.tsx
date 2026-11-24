import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { ArticleSections } from "@/components/shared/article/article-sections";
import { TableOfContents } from "@/components/shared/article/table-of-contents";
import { cn } from "@/lib/utils";
import { DOC_GROUPS, DOC_PAGES, SEARCH_INDEX, docHref } from "../registry";
import type { DocPage } from "../types";
import { DocsSearch } from "./docs-search";

function Sidebar({ current }: { current: DocPage }) {
  return (
    <nav aria-label="Documentation" className="space-y-6 text-sm">
      {DOC_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="mb-2 px-3 font-medium">{group.title}</p>
          <ul className="space-y-0.5">
            {group.pages.map((page) => {
              const active = page.slug === current.slug;
              return (
                <li key={page.slug}>
                  <Link
                    href={docHref(page)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-3 py-1.5 transition-colors hover:text-foreground",
                      active
                        ? "bg-muted font-medium text-brand-text"
                        : "text-muted-foreground",
                    )}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function PrevNext({ current }: { current: DocPage }) {
  const index = DOC_PAGES.indexOf(current);
  const previous = DOC_PAGES[index - 1];
  const next = DOC_PAGES[index + 1];

  return (
    <nav
      aria-label="Previous and next page"
      className="mt-16 grid gap-4 border-t pt-8 sm:grid-cols-2"
    >
      {previous ? (
        <Link
          href={docHref(previous)}
          className="flex items-center gap-3 rounded-lg border p-4 text-sm font-medium hover:border-primary/50"
        >
          <ArrowLeft aria-hidden className="size-4 text-muted-foreground" />
          {previous.title}
        </Link>
      ) : (
        <span className="hidden sm:block" />
      )}
      {next ? (
        <Link
          href={docHref(next)}
          className="flex items-center justify-end gap-3 rounded-lg border p-4 text-sm font-medium hover:border-primary/50"
        >
          {next.title}
          <ArrowRight aria-hidden className="size-4 text-muted-foreground" />
        </Link>
      ) : null}
    </nav>
  );
}

/** Rendered by each page, not by a layout: the active link is known on the server. */
export function DocsArticle({ page }: { page: DocPage }) {
  const toc = page.sections.map(({ id, title }) => ({ id, title }));

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[220px_minmax(0,1fr)_200px]">
      <aside className="hidden lg:block">
        <div className="sticky top-16 max-h-[calc(100svh-4rem)] space-y-6 overflow-y-auto py-10">
          <DocsSearch index={SEARCH_INDEX} />
          <Sidebar current={page} />
        </div>
      </aside>

      <details className="group mt-6 rounded-lg border lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
          Documentation menu
          <ChevronDown
            aria-hidden
            className="size-4 transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="border-t p-4">
          <Sidebar current={page} />
        </div>
      </details>

      <article className="min-w-0 max-w-3xl py-10">
        <header className="mb-10 space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {page.title}
          </h1>
          <p className="text-lg text-muted-foreground">{page.description}</p>
        </header>
        <ArticleSections sections={page.sections} />
        <PrevNext current={page} />
      </article>

      <aside className="hidden xl:block">
        <div className="sticky top-16 max-h-[calc(100svh-4rem)] overflow-y-auto py-10">
          <TableOfContents items={toc} />
        </div>
      </aside>
    </div>
  );
}
