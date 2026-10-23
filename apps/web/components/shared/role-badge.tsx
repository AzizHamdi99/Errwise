import { ShieldCheck } from "lucide-react";
import type { OrgRole } from "@errwise/shared";
import { cn } from "@/lib/utils";

const STYLES: Record<OrgRole, string> = {
  owner: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  admin: "border-violet-500/30 bg-violet-500/10 text-violet-400",
  member: "bg-muted text-muted-foreground",
};

export function RoleBadge({
  role,
  className,
}: {
  role: OrgRole;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium capitalize",
        STYLES[role],
        className,
      )}
    >
      {role === "owner" ? <ShieldCheck className="size-3" aria-hidden /> : null}
      {role}
    </span>
  );
}
