"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { PublicMember, UpdateMemberRoleInput } from "@errwise/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getErrorMessage } from "@/lib/api";
import { displayName } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/permissions";
import { useChangeRole } from "../queries";

type AssignableRole = UpdateMemberRoleInput["role"];

const OPTIONS: { role: AssignableRole; description: string }[] = [
  {
    role: "admin",
    description: "Can invite and remove members, and rename the organization.",
  },
  {
    role: "member",
    description: "Can view projects and issues, and resolve or ignore issues.",
  },
];

interface Props {
  orgId: string;
  member: PublicMember | null;
  onClose: () => void;
}

export function ChangeRoleDialog({ orgId, member, onClose }: Props) {
  return (
    <Dialog
      open={!!member}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
          <DialogDescription>
            {member
              ? `Choose what ${displayName(member)} can do in this organization.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {/* key: a fresh form (and selection) for each member */}
        {member ? (
          <RoleForm
            key={member.userId}
            orgId={orgId}
            member={member}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RoleForm({
  orgId,
  member,
  onClose,
}: {
  orgId: string;
  member: PublicMember;
  onClose: () => void;
}) {
  const change = useChangeRole(orgId);
  const [role, setRole] = useState<AssignableRole>(
    member.role === "admin" ? "admin" : "member",
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    change.mutate(
      { userId: member.userId, role },
      {
        onSuccess: () => {
          toast.success("Role updated");
          onClose();
        },
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {change.isError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{getErrorMessage(change.error)}</AlertDescription>
        </Alert>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="sr-only">Role</legend>
        {OPTIONS.map((option) => (
          <label
            key={option.role}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-accent has-checked:border-primary has-checked:bg-primary/5 has-focus-visible:ring-2 has-focus-visible:ring-ring"
          >
            <input
              type="radio"
              name="role"
              value={option.role}
              checked={role === option.role}
              onChange={() => setRole(option.role)}
              className="mt-1 accent-primary"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium">
                {ROLE_LABELS[option.role]}
              </span>
              <span className="block text-xs text-muted-foreground">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={role === member.role || change.isPending}
        >
          {change.isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            "Save role"
          )}
        </Button>
      </div>
    </form>
  );
}
