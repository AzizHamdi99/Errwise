import type { Metadata } from "next";
import { PRIVACY_UPDATED } from "@/features/legal/details";
import { LegalArticle } from "@/features/legal/legal-article";
import { PRIVACY } from "@/features/legal/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Errwise collects, why, who processes it, and the choices you have.",
  alternates: { canonical: "/privacy" },
};

export default function Page() {
  return (
    <LegalArticle
      title="Privacy Policy"
      updated={PRIVACY_UPDATED}
      intro="What Errwise collects, why, who processes it, and the choices you have."
      sections={PRIVACY}
    />
  );
}
