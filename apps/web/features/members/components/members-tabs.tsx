import Link from "next/link";
import { cn } from "@/lib/utils";

export type MembersTab = "members" | "pending";

interface Tab {
  id: MembersTab;
  label: string;
  href: string;
  count?: number;
}

interface Props {
  orgId: string;
  active: MembersTab;
  showPending: boolean;
  memberCount?: number;
  pendingCount?: number;
}

export function MembersTabs({
  orgId,
  active,
  showPending,
  memberCount,
  pendingCount,
}: Props) {
  const base = `/organizations/${orgId}/members`;
  const tabs: Tab[] = [
    { id: "members", label: "Members", href: base, count: memberCount },
  ];
  if (showPending) {
    tabs.push({
      id: "pending",
      label: "Pending invitations",
      href: `${base}?tab=pending`,
      count: pendingCount,
    });
  }

  return (
    <nav aria-label="Members sections" className="flex gap-6 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          replace
          scroll={false}
          aria-current={tab.id === active ? "page" : undefined}
          className={cn(
            "-mb-px flex items-center gap-2 rounded-sm border-b-2 border-transparent pb-3 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            tab.id === active && "border-primary text-foreground",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className="rounded-md border px-1.5 text-[10px] tabular-nums text-muted-foreground">
              {tab.count}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
