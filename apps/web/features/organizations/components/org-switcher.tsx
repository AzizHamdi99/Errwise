"use client";

import { ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { RoleBadge } from "@/components/shared/role-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { setLastOrgId } from "@/lib/last-org";
import { cn } from "@/lib/utils";
import { useCurrentOrg } from "../use-current-org";
import { CreateOrganizationDialog } from "./create-organization-dialog";

export function OrgSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const { org, orgs, isPending } = useCurrentOrg();
  const [createOpen, setCreateOpen] = useState(false);

  function handleSwitchOrganization(orgId: string) {
    setLastOrgId(orgId);
    onNavigate?.();
    router.push(`/organizations/${orgId}/projects`);
  }

  if (isPending) {
    return <Skeleton className="h-[62px] rounded-xl" />;
  }

  const title =
    org?.name ?? (orgs?.length ? "Select organization" : "No organization");

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          <InitialsAvatar label={title} max={1} />

          <span className="min-w-0 flex-1 space-y-1">
            <span className="block truncate text-sm font-medium">{title}</span>

            {org ? (
              <RoleBadge role={org.role} />
            ) : (
              <span className="block text-xs text-muted-foreground">
                Create one to start
              </span>
            )}
          </span>

          <ChevronsUpDown
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="w-(--anchor-width) min-w-56"
        >
          {orgs?.map((item) => (
            <DropdownMenuItem
              key={item.id}
              aria-current={item.id === org?.id ? "true" : undefined}
              className={cn(
                "relative gap-3 py-2",
                item.id === org?.id &&
                  "bg-accent before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary",
              )}
              onClick={() => handleSwitchOrganization(item.id)}
            >
              <InitialsAvatar label={item.name} max={1} className="size-6" />

              <span className="min-w-0 flex-1 truncate">{item.name}</span>

              <RoleBadge role={item.role} />
            </DropdownMenuItem>
          ))}

          {orgs?.length ? <DropdownMenuSeparator /> : null}

          <DropdownMenuItem
            className="gap-3 py-2"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" aria-hidden />
            Create organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </>
  );
}
