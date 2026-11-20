"use client";

import {
  Bell,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OrgRole } from "@errwise/shared";
import { Brand } from "@/components/shared/brand";
import { UserMenu } from "@/features/auth/components/user-menu";
import { OrgSwitcher } from "@/features/organizations/components/org-switcher";
import { useCurrentOrg } from "@/features/organizations/use-current-org";
import { cn } from "@/lib/utils";
import { PendingCountBadge } from "@/features/invitations/components/pending-count-badge";
import { ThemeToggle } from "../shared/theme-toggle";

// The pages used every day sit at the top. Settings is rarely opened, so it is
// pinned to the bottom, next to the account menu.
const MAIN_NAV = [
  { label: "Overview", segment: "", icon: LayoutDashboard },
  { label: "Projects", segment: "projects", icon: FolderKanban },
  { label: "Usage", segment: "usage", icon: Gauge },
  { label: "Alerts", segment: "alerts", icon: Bell },
  { label: "Members", segment: "members", icon: Users },
] as const;

const FOOTER_NAV = [
  { label: "Settings", segment: "settings", icon: Settings },
] as const;

type NavEntry = (typeof MAIN_NAV)[number] | (typeof FOOTER_NAV)[number];

function NavItem({
  item,
  orgId,
  role,
  pathname,
  onNavigate,
}: {
  item: NavEntry;
  orgId: string;
  role: OrgRole;
  pathname: string;
  onNavigate?: () => void;
}) {
  const { label, segment, icon: Icon } = item;
  const orgHref = `/organizations/${orgId}`;
  const href = segment ? `${orgHref}/${segment}` : orgHref;
  // Every org page lives under the overview's path, so it only matches exactly.
  const active = segment ? pathname.startsWith(href) : pathname === href;

  return (
    <Link
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
      {segment === "members" ? (
        <PendingCountBadge orgId={orgId} role={role} />
      ) : null}
    </Link>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { org } = useCurrentOrg();

  return (
    <div className="flex h-full flex-col gap-5 p-3">
      <div className="flex items-center justify-between">
        <Link
          href="/organizations"
          onClick={onNavigate}
          className="rounded-md px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Brand />
        </Link>
        <ThemeToggle />
      </div>
      <OrgSwitcher onNavigate={onNavigate} />

      {org ? (
        <nav aria-label="Main" className="space-y-1">
          {MAIN_NAV.map((item) => (
            <NavItem
              key={item.label}
              item={item}
              orgId={org.id}
              role={org.role}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      ) : null}

      <div className="mt-auto space-y-3">
        {org ? (
          <nav aria-label="Workspace" className="space-y-1">
            {FOOTER_NAV.map((item) => (
              <NavItem
                key={item.label}
                item={item}
                orgId={org.id}
                role={org.role}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </nav>
        ) : null}
        <UserMenu />
      </div>
    </div>
  );
}
