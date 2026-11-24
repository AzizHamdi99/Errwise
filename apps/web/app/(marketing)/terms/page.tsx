import type { Metadata } from "next";
import { TERMS_UPDATED } from "@/features/legal/details";
import { LegalArticle } from "@/features/legal/legal-article";
import { TERMS } from "@/features/legal/terms";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using Errwise, and what you agree to when you share data or code with it.",
  alternates: { canonical: "/terms" },
};

export default function Page() {
  return (
    <LegalArticle
      title="Terms of Service"
      updated={TERMS_UPDATED}
      intro="The rules for using Errwise, and what you agree to when you share data or code with it."
      sections={TERMS}
    />
  );
}
