import type { Metadata } from "next";
import { CodeTabs } from "@/features/marketing/components/code-tabs";
import { FeatureSections } from "@/features/marketing/components/feature-sections";
import { FinalCta } from "@/features/marketing/components/final-cta";
import { Hero } from "@/features/marketing/components/hero";
import { HowItWorks } from "@/features/marketing/components/how-it-works";
import { JsonLd } from "@/features/marketing/components/json-ld";
import { MotionProvider } from "@/features/marketing/components/motion-provider";
import { RoadmapTeaser } from "@/features/marketing/components/roadmap-teaser";
import { TrustStrip } from "@/features/marketing/components/trust-strip";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} · ${SITE_TAGLINE}` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

export default function LandingPage() {
  return (
    <MotionProvider>
      {/* Without JavaScript nothing would ever reveal the hidden blocks */}
      <noscript>
        <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <JsonLd />
      <Hero />
      <HowItWorks />
      <FeatureSections />
      <CodeTabs />
      <TrustStrip />
      <RoadmapTeaser />
      <FinalCta />
    </MotionProvider>
  );
}
