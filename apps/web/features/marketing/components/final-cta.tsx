import { CtaButtons } from "./cta-buttons";
import { HeroBackground } from "./hero-background";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden border-t px-4 py-28 sm:px-6">
      <HeroBackground />
      <Reveal className="mx-auto max-w-2xl space-y-8 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          Find out before your users tell you.
        </h2>
        <p className="text-lg text-muted-foreground">
          Create a project, add the SDK, and send your first error.
        </p>
        <CtaButtons />
      </Reveal>
    </section>
  );
}
