import { CheckCircle2 } from "lucide-react";

export function FirstErrorStatus({ received }: { received: boolean }) {
  return (
    <div
      aria-live="polite"
      className="flex flex-col items-center gap-3 rounded-lg border p-5 text-center"
    >
      {received ? (
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-500">
          <CheckCircle2 className="size-3.5" aria-hidden />
          First error received
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          Waiting for your first error…
        </span>
      )}
      <p className="text-sm text-muted-foreground">
        {received
          ? "Your project is connected. Open the dashboard to see it."
          : "Trigger a test exception from your service. This page updates automatically."}
      </p>
    </div>
  );
}
