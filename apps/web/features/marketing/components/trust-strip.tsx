import { Code2, EyeOff, KeyRound, Layers } from "lucide-react";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

const ITEMS = [
  {
    icon: EyeOff,
    title: "Scrubbed before storage",
    text: "Emails, tokens, provider keys and card numbers are masked on the server, whatever the client sends.",
  },
  {
    icon: KeyRound,
    title: "Hashed API keys",
    text: "Shown once, stored only as a SHA-256 hash, and revocable at any time.",
  },
  {
    icon: Layers,
    title: "Tenant isolation",
    text: "Every query is scoped to your organization. Anything outside it answers 404, so ids do not leak.",
  },
  {
    icon: Code2,
    title: "Open SDK",
    text: "The code that runs inside your app is MIT licensed and has zero runtime dependencies.",
  },
];

export function TrustStrip() {
  return (
    <section id="security" className="scroll-mt-16 border-t px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Security" title="Careful with your data" />
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ icon: Icon, title, text }, index) => (
            <li key={title}>
              <Reveal delay={index * 0.06} className="h-full">
                <div className="h-full rounded-xl border bg-card p-6 transition-[border-color,transform] duration-200 hover:-translate-y-1 hover:border-primary/50 motion-reduce:hover:translate-y-0">
                  <Icon aria-hidden className="size-5 text-brand-text" />
                  <h3 className="mt-4 font-medium">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {text}
                  </p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
