import type { ArticleSection } from "@/components/shared/article/types";

export interface DocPage {
  /** Empty for the first page, served at /docs. */
  slug: string;
  title: string;
  description: string;
  sections: ArticleSection[];
}

export interface SearchEntry {
  href: string;
  page: string;
  section?: string;
}
