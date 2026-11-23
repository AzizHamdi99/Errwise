import { Loader2, Wrench } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/** The frame of the suggested fix: same look as the AI analysis above it. */
export function FixShell({
  actions,
  children,
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label="Suggested fix"
      className="overflow-hidden rounded-xl border border-primary/25 bg-card"
    >
      <header className="flex items-center justify-between gap-2 border-b border-primary/15 bg-primary/5 px-4 py-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Wrench className="size-4 text-primary" aria-hidden />
          Suggested fix
        </h2>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function FixLoading({ label }: { label: string }) {
  return (
    <div className="space-y-4 px-4 py-5" aria-busy="true">
      <p
        role="status"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
        {label}
      </p>
      <div className="space-y-2">
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
