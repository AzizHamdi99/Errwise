import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Organization", "Project", "Install SDK"] as const;

export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-3" aria-label="Onboarding progress">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;

        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="flex flex-1 items-center gap-3 last:flex-none"
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs transition-colors",
                active && "border-primary text-foreground",
                done && "border-primary bg-primary/15 text-primary",
                !active && !done && "text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : step}
            </span>
            <span
              className={cn(
                "sr-only text-sm sm:not-sr-only",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {step < STEPS.length ? (
              <span aria-hidden className="h-px flex-1 bg-border" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
