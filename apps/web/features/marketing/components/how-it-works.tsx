import { CrashDemo } from "./crash-demo";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const STEPS = [
  {
    title: "Install",
    text: "Add one package and call init with your project key.",
  },
  {
    title: "Crash",
    text: "An error happens. The SDK queues it and sends it in the background, so your app never waits.",
  },
  {
    title: "See it grouped",
    text: "The same crash lands on the same issue. The counter goes up, your inbox stays quiet.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-16 border-t px-4 py-24 sm:px-6"
    >
      <div className="mx-auto max-w-5xl">
        <SectionHeading
          eyebrow="How it works"
          title="From a crash to an issue in three steps"
        />
        <Reveal className="mt-14">
          <CrashDemo />
        </Reveal>
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <Reveal delay={index * 0.08}>
                <p className="font-mono text-sm text-brand-text">
                  {index + 1}
                </p>
                <h3 className="mt-2 text-lg font-medium">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {step.text}
                </p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
