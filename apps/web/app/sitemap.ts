import type { MetadataRoute } from "next";
import { DOC_PAGES, docHref } from "@/features/docs/registry";
import { SITE_URL } from "@/lib/site-url";

const PATHS = ["/", ...DOC_PAGES.map(docHref), "/terms", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({ url: new URL(path, SITE_URL).href }));
}
