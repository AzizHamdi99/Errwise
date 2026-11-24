import { CtaButtons } from "./cta-buttons";
import { HeroBackground } from "./hero-background";
import { InstallCommand } from "./install-command";
import { ScreenshotFrame } from "./screenshot-frame";
import { TiltOnScroll } from "./tilt-on-scroll";

const FACTS = [
  "Zero runtime dependencies",
  "Express and NestJS",
  "MIT licensed SDK",
];

export function Hero() {
  return (
    <section className="relative isolate px-4 pt-20 pb-24 sm:px-6 sm:pt-28">
      <HeroBackground />

      <div className="mx-auto max-w-3xl text-center">
        {/* Never hidden or animated: it is what the visitor should see first */}
        <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance sm:text-6xl">
          Every crash, grouped and{" "}
          <span className="text-brand-text">explained</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-muted-foreground">
          Error monitoring for Node.js. Install one package and turn a flood of
          errors into a short list of issues your team can act on.
        </p>

        <div className="mt-8">
          <CtaButtons />
        </div>

        <div className="mt-8">
          <InstallCommand />
        </div>

        <ul className="mt-5 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {FACTS.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </div>

      <div className="mx-auto mt-16 max-w-6xl">
        <TiltOnScroll>
          <ScreenshotFrame
            name="issues-list"
            alt="The Errwise issues list: errors grouped into issues, each with its event count"
            sizes="(min-width: 1200px) 1152px, calc(100vw - 32px)"
            label="errwise / issues"
            important
          />
        </TiltOnScroll>
      </div>
    </section>
  );
}
