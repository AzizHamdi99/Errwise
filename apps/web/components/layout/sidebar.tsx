"use client";

import { FolderKanban, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "@/components/shared/brand";
import { UserMenu } from "@/features/auth/components/user-menu";
import { OrgSwitcher } from "@/features/organizations/components/org-switcher";
import { useCurrentOrg } from "@/features/organizations/use-current-org";
import { cn } from "@/lib/utils";

const NAV = [
  { label: "Projects", segment: "projects", icon: FolderKanban },
  { label: "Members", segment: "members", icon: Users },
  { label: "Settings", segment: "settings", icon: Settings },
] as const;

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { org } = useCurrentOrg();

  return (
    <div className="flex h-full flex-col gap-5 p-3">
      <Link
        href="/organizations"
        onClick={onNavigate}
        className="rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Brand />
      </Link>

      <OrgSwitcher onNavigate={onNavigate} />

      {org ? (
        <nav aria-label="Main" className="space-y-1">
          {NAV.map(({ label, segment, icon: Icon }) => {
            const href = `/organizations/${org.id}/${segment}`;
            const active = pathname.startsWith(href);
            return (
              <Link
                key={segment}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                  active &&
                    "bg-accent text-foreground before:absolute before:inset-y-1.5 before:-left-3 before:w-0.5 before:rounded-full before:bg-primary",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <div className="mt-auto">
        <UserMenu />
      </div>
    </div>
  );
}
