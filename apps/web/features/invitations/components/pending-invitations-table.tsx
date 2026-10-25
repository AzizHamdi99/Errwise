"use client";

import type { OrgRole, PublicInvitation } from "@errwise/shared";
import { RelativeTime } from "@/components/shared/relative-time";
import { RoleBadge } from "@/components/shared/role-badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { canManageInvitation } from "@/lib/permissions";

interface Props {
  invitations: PublicInvitation[];
  actorRole: OrgRole;
  resendingId: string | null;
  onResend: (invitation: PublicInvitation) => void;
  onRevoke: (invitation: PublicInvitation) => void;
}

export function PendingInvitationsTable({
  invitations,
  actorRole,
  resendingId,
  onResend,
  onRevoke,
}: Props) {
  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Invited by</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => {
            const manageable = canManageInvitation(actorRole, invitation.role);
            return (
              <TableRow key={invitation.id}>
                <TableCell className="font-medium">
                  {invitation.email}
                </TableCell>
                <TableCell>
                  <RoleBadge role={invitation.role} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {invitation.invitedBy ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  <RelativeTime iso={invitation.expiresAt} />
                </TableCell>
                <TableCell className="text-right">
                  {manageable ? (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={resendingId === invitation.id}
                        aria-label={`Resend invitation to ${invitation.email}`}
                        onClick={() => onResend(invitation)}
                      >
                        {resendingId === invitation.id ? "Sending…" : "Resend"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Revoke invitation to ${invitation.email}`}
                        onClick={() => onRevoke(invitation)}
                      >
                        Revoke
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Owner only
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
