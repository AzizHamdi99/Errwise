"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Issues", segment: "issues" },
  { label: "API keys", segment: "api-keys" },
  { label: "Settings", segment: "settings" },
] as const;

export function ProjectTabs({
  orgId,
  projectId,
}: {
  orgId: string;
  projectId: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Project" className="flex gap-6 border-b">
      {TABS.map(({ label, segment }) => {
        const href = `/organizations/${orgId}/projects/${projectId}/${segment}`;
        const active = pathname.startsWith(href);
        return (
          <Link
            key={segment}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px rounded-sm border-b-2 border-transparent pb-3 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              active && "border-primary text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
