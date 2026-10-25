"use client";

import type { OrgRole } from "@errwise/shared";
import { can } from "@/lib/permissions";
import { useInvitations } from "../queries";

export function PendingCountBadge({
  orgId,
  role,
}: {
  orgId: string;
  role: OrgRole;
}) {
  const { data } = useInvitations(orgId, can(role, "invitation.manage"));
  if (!data?.length) return null;

  return (
    <span className="ml-auto rounded-md bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
      <span className="sr-only">Pending invitations: </span>
      {data.length}
    </span>
  );
}
