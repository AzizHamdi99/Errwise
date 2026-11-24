import { alerts } from "./pages/alerts";
import { apiReference } from "./pages/api-reference";
import { faq } from "./pages/faq";
import { github } from "./pages/github";
import { grouping } from "./pages/grouping";
import { integrations } from "./pages/integrations";
import { introduction } from "./pages/introduction";
import { quickstart } from "./pages/quickstart";
import { regressions } from "./pages/regressions";
import { sdk } from "./pages/sdk";
import { security } from "./pages/security";
import { sourceAndAi } from "./pages/source-and-ai";
import { team } from "./pages/team";
import type { DocPage, SearchEntry } from "./types";

/**
 * To add a page: create its file in pages/, list it here, and copy a route file of
 * app/(marketing)/docs. One static route per page, not [slug]: with Cache Components a dynamic
 * param makes the navigation wait. The sidebar, search, sitemap and prev/next follow this list.
 */
export const DOC_GROUPS: { title: string; pages: DocPage[] }[] = [
  { title: "Get started", pages: [introduction, quickstart] },
  { title: "SDK", pages: [sdk, integrations] },
  {
    title: "Product",
    pages: [grouping, alerts, regressions, github, sourceAndAi, team],
  },
  { title: "Reference", pages: [apiReference, security, faq] },
];

export const DOC_PAGES = DOC_GROUPS.flatMap((group) => group.pages);

export const docHref = (page: DocPage) =>
  page.slug ? `/docs/${page.slug}` : "/docs";

export const SEARCH_INDEX: SearchEntry[] = DOC_PAGES.flatMap((page) => [
  { href: docHref(page), page: page.title },
  ...page.sections.map((section) => ({
    href: `${docHref(page)}#${section.id}`,
    page: page.title,
    section: section.title,
  })),
]);
