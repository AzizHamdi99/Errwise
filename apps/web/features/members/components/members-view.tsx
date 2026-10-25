"use client";

import { CircleHelp, MailPlus, TriangleAlert, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import type { PublicInvitation, PublicMember } from "@errwise/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Eyebrow } from "@/components/shared/eyebrow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/features/auth/queries";
import { InviteDialog } from "@/features/invitations/components/invite-dialog";
import { PendingInvitationsTable } from "@/features/invitations/components/pending-invitations-table";
import { invitationErrorMessage } from "@/features/invitations/errors";
import {
  useInvitations,
  useResendInvitation,
  useRevokeInvitation,
} from "@/features/invitations/queries";
import { useCurrentOrg } from "@/features/organizations/use-current-org";
import { getErrorMessage } from "@/lib/api";
import { displayName } from "@/lib/format";
import { clearLastOrgId } from "@/lib/last-org";
import { can, invitableRoles } from "@/lib/permissions";
import { useMembers, useRemoveMember } from "../queries";
import { ChangeRoleDialog } from "./change-role-dialog";
import { MembersTable } from "./members-table";
import { MembersTabs } from "./members-tabs";
import type { MembersTab } from "./members-tabs";
import { RolesDialog } from "./roles-dialog";

export function MembersView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: me } = useMe();
  const { org } = useCurrentOrg();
  const orgId = org?.id ?? "";
  const canInvite = !!org && can(org.role, "invitation.manage");

  const members = useMembers(orgId);
  const invitations = useInvitations(orgId, canInvite);
  const removeMember = useRemoveMember(orgId);
  const leaveOrg = useRemoveMember(orgId); // separate instance: separate pending and error state
  const resend = useResendInvitation(orgId);
  const revoke = useRevokeInvitation(orgId);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<PublicMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<PublicMember | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<PublicInvitation | null>(
    null,
  );

  if (!org || !me) return null; // OrgGate and RequireAuth guarantee this never happens

  const tab: MembersTab =
    searchParams.get("tab") === "pending" && canInvite ? "pending" : "members";
  const resendingId = resend.isPending ? resend.variables : null;

  function handleResend(invitation: PublicInvitation) {
    resend.mutate(invitation.id, {
      onSuccess: () =>
        toast.success(`Invitation resent to ${invitation.email}`),
      onError: (error) => toast.error(invitationErrorMessage(error)),
    });
  }

  let body: React.ReactNode;
  if (tab === "members") {
    if (members.isPending) {
      body = <Skeleton className="h-52 rounded-xl" aria-busy="true" />;
    } else if (members.isError) {
      body = (
        <EmptyState
          icon={TriangleAlert}
          title="Couldn't load members"
          description={getErrorMessage(members.error)}
          action={
            <Button variant="outline" onClick={() => members.refetch()}>
              Try again
            </Button>
          }
        />
      );
    } else {
      body = (
        <div className="space-y-4">
          <MembersTable
            members={members.data}
            meId={me.id}
            actorRole={org.role}
            onChangeRole={setRoleTarget}
            onRemove={setRemoveTarget}
            onLeave={() => setLeaveOpen(true)}
          />
          <p className="rounded-xl border bg-card/40 px-5 py-4 text-sm text-muted-foreground">
            Owners can change roles and remove members. Admins can invite
            members and remove members. Everyone can view projects and issues.
          </p>
        </div>
      );
    }
  } else if (invitations.isPending) {
    body = <Skeleton className="h-40 rounded-xl" aria-busy="true" />;
  } else if (invitations.isError) {
    body = (
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load invitations"
        description={getErrorMessage(invitations.error)}
        action={
          <Button variant="outline" onClick={() => invitations.refetch()}>
            Try again
          </Button>
        }
      />
    );
  } else if (invitations.data.length === 0) {
    body = (
      <EmptyState
        icon={MailPlus}
        title="No pending invitations"
        description="People you invite appear here until they accept."
        action={
          <Button onClick={() => setInviteOpen(true)}>Invite people</Button>
        }
      />
    );
  } else {
    body = (
      <PendingInvitationsTable
        invitations={invitations.data}
        actorRole={org.role}
        resendingId={resendingId}
        onResend={handleResend}
        onRevoke={setRevokeTarget}
      />
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Eyebrow>{org.name} / Workspace</Eyebrow>
          <h1 className="text-3xl font-semibold tracking-tight">Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage access to your organization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canInvite ? (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus aria-hidden />
              Invite people
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Only owners and admins can invite people.
            </p>
          )}
          <Button variant="outline" onClick={() => setRolesOpen(true)}>
            <CircleHelp aria-hidden />
            Roles
          </Button>
        </div>
      </header>

      <div className="space-y-6">
        <MembersTabs
          orgId={org.id}
          active={tab}
          showPending={canInvite}
          memberCount={members.data?.length}
          pendingCount={invitations.data?.length}
        />
        {body}
      </div>

      <InviteDialog
        orgId={org.id}
        orgName={org.name}
        roles={invitableRoles(org.role)}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onInvited={() =>
          router.replace(`/organizations/${org.id}/members?tab=pending`)
        }
      />
      <RolesDialog open={rolesOpen} onOpenChange={setRolesOpen} />
      <ChangeRoleDialog
        orgId={org.id}
        member={roleTarget}
        onClose={() => setRoleTarget(null)}
      />

      <ConfirmDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (open) return;
          removeMember.reset();
          setRemoveTarget(null);
        }}
        title={
          removeTarget
            ? `Remove ${displayName(removeTarget)}?`
            : "Remove member?"
        }
        description={
          removeTarget
            ? `${displayName(removeTarget)} will lose access to all projects. They can be invited again later.`
            : ""
        }
        actionLabel="Remove member"
        pendingLabel="Removing…"
        isPending={removeMember.isPending}
        error={
          removeMember.isError ? getErrorMessage(removeMember.error) : null
        }
        onConfirm={() => {
          if (!removeTarget) return;
          removeMember.mutate(removeTarget.userId, {
            onSuccess: () => {
              toast.success(`${displayName(removeTarget)} was removed`);
              setRemoveTarget(null);
            },
          });
        }}
      />

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={(open) => {
          if (open) return;
          leaveOrg.reset();
          setLeaveOpen(false);
        }}
        title={`Leave ${org.name}?`}
        description="You will lose access to this organization and its projects. An owner has to invite you again to rejoin."
        actionLabel="Leave organization"
        pendingLabel="Leaving…"
        isPending={leaveOrg.isPending || leaveOrg.isSuccess}
        error={leaveOrg.isError ? getErrorMessage(leaveOrg.error) : null}
        onConfirm={() =>
          leaveOrg.mutate(me.id, {
            onSuccess: () => {
              clearLastOrgId(org.id);
              // A full load drops every cached query of this organization.
              window.location.assign("/organizations");
            },
          })
        }
      />

      <ConfirmDialog
        open={!!revokeTarget}
        onOpenChange={(open) => {
          if (open) return;
          revoke.reset();
          setRevokeTarget(null);
        }}
        title="Revoke invitation?"
        description={
          revokeTarget
            ? `The link sent to ${revokeTarget.email} will stop working.`
            : ""
        }
        actionLabel="Revoke invitation"
        pendingLabel="Revoking…"
        isPending={revoke.isPending}
        error={revoke.isError ? getErrorMessage(revoke.error) : null}
        onConfirm={() => {
          if (!revokeTarget) return;
          revoke.mutate(revokeTarget.id, {
            onSuccess: () => {
              toast.success("Invitation revoked");
              setRevokeTarget(null);
            },
          });
        }}
      />
    </div>
  );
}
