import type { AiUsageStatus } from "@errwise/shared";
import { cn } from "@/lib/utils";

export function AiQuotaCard({ ai }: { ai: AiUsageStatus }) {
  const { usedToday, dailyLimit } = ai;
  const full = usedToday >= dailyLimit;
  const percent = Math.min(100, Math.round((usedToday / dailyLimit) * 100));

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">
        AI analyses today
      </p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
        {usedToday}
        <span className="text-lg font-normal text-muted-foreground">
          {" "}
          / {dailyLimit}
        </span>
      </p>
      <div
        role="progressbar"
        aria-label="AI analyses used today"
        aria-valuemin={0}
        aria-valuemax={dailyLimit}
        aria-valuenow={Math.min(usedToday, dailyLimit)}
        className="mt-2 h-1.5 rounded-full bg-muted"
      >
        <div
          className={cn(
            "h-1.5 rounded-full transition-[width]",
            full ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p
        className={cn(
          "mt-1.5 text-xs",
          full ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {full ? "Limit reached. " : ""}Resets at 00:00 UTC.
      </p>
    </div>
  );
}
