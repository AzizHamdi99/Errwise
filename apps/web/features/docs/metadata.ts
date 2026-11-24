import type { Metadata } from "next";
import { docHref } from "./registry";
import type { DocPage } from "./types";

export function docMetadata(page: DocPage): Metadata {
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: docHref(page) },
  };
}
