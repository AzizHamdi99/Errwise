import { AlertCircle, CheckCircle2, EyeOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { IssueStatus } from "@errwise/shared";

const META: Record<
  IssueStatus,
  { label: string; icon: LucideIcon; text: string; badge: string }
> = {
  unresolved: {
    label: "Unresolved",
    icon: AlertCircle,
    text: "text-destructive",
    badge: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  resolved: {
    label: "Resolved",
    icon: CheckCircle2,
    text: "text-emerald-500",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
  },
  ignored: {
    label: "Ignored",
    icon: EyeOff,
    text: "text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  },
};

export const issueStatusMeta = (status: IssueStatus) => META[status];

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  const { label, icon: Icon, badge } = META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${badge}`}
    >
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}
