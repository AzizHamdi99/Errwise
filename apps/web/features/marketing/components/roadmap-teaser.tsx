import { Sparkles } from "lucide-react";
import { Reveal } from "./reveal";
import { SectionHeading } from "./section-heading";

// Only what is in docs/adr/Roadmap after the MVP.md. Move an item out when it ships.
const HIGHLIGHTS = [
  {
    title: "Suspect commits",
    text: "The recent commits that touched the files in the stack trace.",
  },
  {
    title: "Similar issues",
    text: "Related errors found by meaning, to merge what a fingerprint keeps apart.",
  },
];

const ITEMS = [
  "Breadcrumbs",
  "User context and tags",
  "Browser SDK",
  "Source maps",
  "Spike detection",
  "Slack and Discord alerts",
];

export function RoadmapTeaser() {
  return (
    <section id="roadmap" className="scroll-mt-16 border-t px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <SectionHeading eyebrow="Coming soon" title="What we want to build next">
          On the roadmap, not available yet.
        </SectionHeading>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {HIGHLIGHTS.map((item, index) => (
            <Reveal
              key={item.title}
              delay={index * 0.06}
              className="rounded-xl border border-primary/30 bg-primary/5 p-6"
            >
              <p className="flex items-center gap-2 text-xs font-medium text-brand-text">
                <Sparkles aria-hidden className="size-3.5" />
                AI
              </p>
              <h3 className="mt-3 text-lg font-medium">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.text}
              </p>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-6">
          <ul className="flex flex-wrap justify-center gap-2">
            {ITEMS.map((item) => (
              <li
                key={item}
                className="rounded-full border px-4 py-1.5 text-sm text-muted-foreground"
              >
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
