import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number | undefined;
  /** Small text under the value, e.g. "last 7 days". */
  hint?: string;
  /** Change against the previous window. More errors is bad, so up is red. */
  delta?: { current: number; previous: number };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {current === 0 ? "no change" : "new activity"}
      </span>
    );
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) {
    return <span className="text-xs text-muted-foreground">no change</span>;
  }
  const up = percent > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        up ? "text-destructive" : "text-emerald-500",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(percent)}%
      <span className="sr-only">{up ? " more" : " fewer"} than before</span>
    </span>
  );
}

export function StatCard({ label, value, hint, delta }: Props) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {value === undefined ? (
        <Skeleton className="mt-2 h-8 w-16" />
      ) : (
        <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
          {formatNumber(value)}
        </p>
      )}
      <div className="mt-1 flex min-h-4 items-center gap-2">
        {delta && value !== undefined ? <Delta {...delta} /> : null}
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </div>
    </div>
  );
}
