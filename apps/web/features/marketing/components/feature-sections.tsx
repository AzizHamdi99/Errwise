import { Check } from "lucide-react";
import { Eyebrow } from "@/components/shared/eyebrow";
import { cn } from "@/lib/utils";
import type { ScreenshotName } from "../screenshots";
import { Reveal } from "./reveal";
import { ScreenshotFrame } from "./screenshot-frame";
import { SectionHeading } from "./section-heading";

interface Shot {
  name: ScreenshotName;
  alt: string;
  label: string;
}

interface Feature {
  eyebrow: string;
  title: string;
  text: string;
  points: string[];
  shots: Shot[];
}

const FEATURES: Feature[] = [
  {
    eyebrow: "Triage",
    title: "One issue, not a thousand errors",
    text: "Errors are fingerprinted by type, message and the top frame of your own code. Ids, numbers and quoted values are ignored, so the same bug stays one issue.",
    points: [
      "Filter by status and environment, or search",
      "Resolve or ignore many issues at once",
      "A trend line and an event count on every row",
    ],
    shots: [
      {
        name: "project-overview",
        alt: "A project overview with errors over time and the top issues",
        label: "errwise / overview",
      },
    ],
  },
  {
    eyebrow: "Context",
    title: "Everything you need on one page",
    text: "Open an issue and see where it broke, in which release, and what the app was running on.",
    points: [
      "Your frames first, node_modules out of the way",
      "Environment, release, commit and runtime",
      "The most recent events, one click apart",
    ],
    shots: [
      {
        name: "issue-detail",
        alt: "An issue page with its stack trace, release, runtime and recent events",
        label: "errwise / issue",
      },
    ],
  },
  {
    eyebrow: "GitHub",
    title: "Your issue tracker stays the source of truth",
    text: "Create a GitHub issue in one click. Close it on GitHub and Errwise resolves the error. Reopen it and the error is unresolved again.",
    points: [
      "One repository per project, through a GitHub App",
      "Access tokens limited to one purpose and one repository",
      "Reads source code only if the owner turns it on",
    ],
    shots: [
      {
        name: "github-integration",
        alt: "The GitHub integration of a project, connected to a repository",
        label: "errwise / integrations",
      },
    ],
  },
  {
    eyebrow: "Alerts",
    title: "An email when it matters",
    text: "Follow a project and get an email the first time an issue appears, and again if a resolved one comes back. The next thousand occurrences only move the counter.",
    points: [
      "Every member chooses the projects they follow",
      "Environment, release and time in every email",
      "Only a new issue or a regression sends one",
    ],
    shots: [
      {
        name: "alert-email",
        alt: "The email Errwise sends when a resolved issue happens again",
        label: "Regression email",
      },
    ],
  },
  {
    eyebrow: "Regressions",
    title: "Know when a fix did not hold",
    text: "When a resolved issue happens again, Errwise reopens it, emails its followers, and reopens the linked GitHub issue with a comment.",
    points: [
      "A filter for the issues that came back",
      "One email per regression, with how often it came back",
      "Ignored issues stay ignored",
    ],
    shots: [
      {
        name: "regression",
        alt: "An issue that was resolved and came back, with its linked GitHub issue",
        label: "errwise / regression",
      },
    ],
  },
];

const AI_STEPS: { title: string; text: string; shot: Shot }[] = [
  {
    title: "Understand it",
    text: "Ask for an analysis and get the probable cause, a suggested fix and an honest confidence level. With source code on, it reads the real lines around each failing frame.",
    shot: {
      name: "ai-analysis",
      alt: "An AI analysis with its summary, probable cause and confidence",
      label: "errwise / analysis",
    },
  },
  {
    title: "Fix it",
    text: "Review the suggested change as a diff. An owner or admin can open it as a draft pull request. Errwise never merges and never force-pushes.",
    shot: {
      name: "suggested-fix",
      alt: "A suggested fix shown as a diff, before opening a draft pull request",
      label: "errwise / suggested fix",
    },
  },
];

function FeatureRow({ feature, flip }: { feature: Feature; flip: boolean }) {
  return (
    <div
      className={cn(
        "grid items-center gap-10 lg:gap-16",
        flip ? "lg:grid-cols-[3fr_2fr]" : "lg:grid-cols-[2fr_3fr]",
      )}
    >
      <Reveal className={cn("space-y-5", flip && "lg:order-2")}>
        <Eyebrow>{feature.eyebrow}</Eyebrow>
        <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {feature.title}
        </h3>
        <p className="leading-relaxed text-pretty text-muted-foreground">
          {feature.text}
        </p>
        <ul className="space-y-2.5">
          {feature.points.map((point) => (
            <li key={point} className="flex gap-3 text-sm">
              <Check
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-brand-text"
              />
              {point}
            </li>
          ))}
        </ul>
      </Reveal>
      <Reveal delay={0.08} className={cn("min-w-0", flip && "lg:order-1")}>
        {feature.shots.map((shot) => (
          <ScreenshotFrame
            key={shot.name}
            {...shot}
            sizes="(min-width: 1024px) 660px, calc(100vw - 32px)"
          />
        ))}
      </Reveal>
    </div>
  );
}

function AiFeature() {
  return (
    <div className="rounded-2xl border bg-card/50 p-6 sm:p-10">
      <SectionHeading
        eyebrow="AI, with a human in charge"
        title="From stack trace to draft pull request"
        level={3}
      >
        Nothing runs on its own. Every step is a click, and reading or changing
        your code is off until the project owner turns it on.
      </SectionHeading>
      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        {AI_STEPS.map((step, index) => (
          <Reveal
            key={step.title}
            delay={index * 0.08}
            className="min-w-0 space-y-6"
          >
            <ScreenshotFrame
              {...step.shot}
              sizes="(min-width: 1024px) 510px, calc(100vw - 80px)"
            />
            <div>
              <h4 className="text-lg font-medium">{step.title}</h4>
              <p className="mt-2 leading-relaxed text-pretty text-muted-foreground">
                {step.text}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

export function FeatureSections() {
  const [triage, context, ...rest] = FEATURES;

  return (
    <section
      id="features"
      className="scroll-mt-16 border-t px-4 py-24 sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Features"
          title="Less noise, more of the story"
        >
          Find the error that matters, understand it, and get it to the person
          who fixes it.
        </SectionHeading>
        <div className="mt-20 space-y-24 sm:space-y-32">
          {triage ? <FeatureRow feature={triage} flip={false} /> : null}
          {context ? <FeatureRow feature={context} flip /> : null}
          <AiFeature />
          {rest.map((feature, index) => (
            <FeatureRow
              key={feature.title}
              feature={feature}
              flip={index % 2 === 1}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
