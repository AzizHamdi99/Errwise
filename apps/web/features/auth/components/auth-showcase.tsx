import { AlertCircle } from "lucide-react";
import { Brand } from "@/components/shared/brand";

export function AuthShowcase() {
  return (
    <aside className="relative hidden overflow-hidden border-l bg-card/40 lg:block">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_55%_30%,rgb(123_87_242/0.28),transparent_70%)]"
      />

      <div className="relative flex h-full min-h-svh flex-col justify-between p-12 xl:px-16">
        <Brand />

        <div className="max-w-md space-y-8">
          <div className="space-y-4">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Errwise / Issue context
            </p>
            <h2 className="text-4xl font-medium leading-[1.1] tracking-tight text-balance">
              Every crash, grouped and explained.
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Find the first useful frame, the release that introduced it, and
              who can act on it.
            </p>
          </div>

          {/* Decorative preview of an issue */}
          <div
            aria-hidden
            className="rounded-xl border bg-background/50 p-5 backdrop-blur-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 size-4 text-destructive" />
                <p className="font-mono text-xs text-destructive">
                  TypeError: Cannot read property &apos;name&apos;
                </p>
              </div>
              <span className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive">
                Unresolved
              </span>
            </div>

            <dl className="mt-4 space-y-3 border-t pt-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <dt>production · release 1.4.0</dt>
                <dd className="tabular-nums">142 events</dd>
              </div>
              <div className="flex justify-between border-t pt-3">
                <dt className="font-mono text-foreground/80">
                  at getUser src/users/users.service.js:42
                </dt>
                <dd>2m ago</dd>
              </div>
            </dl>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Focused error context for the people fixing it.
        </p>
      </div>
    </aside>
  );
}
