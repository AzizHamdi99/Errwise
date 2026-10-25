"use client";

import { Trash2 } from "lucide-react";
import type { OrgRole, PublicMember } from "@errwise/shared";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
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
import { displayName, formatDate } from "@/lib/format";
import { can, canRemoveMember } from "@/lib/permissions";

interface Props {
  members: PublicMember[];
  meId: string;
  actorRole: OrgRole;
  onChangeRole: (member: PublicMember) => void;
  onRemove: (member: PublicMember) => void;
  onLeave: () => void;
}

export function MembersTable({
  members,
  meId,
  actorRole,
  onChangeRole,
  onRemove,
  onLeave,
}: Props) {
  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => {
            const isMe = member.userId === meId;
            const name = displayName(member);
            const canChange =
              can(actorRole, "member.changeRole") &&
              member.role !== "owner" &&
              !isMe;
            const canRemove = !isMe && canRemoveMember(actorRole, member.role);

            return (
              <TableRow key={member.userId}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <InitialsAvatar label={name} />
                    <span className="font-medium">
                      {name}
                      {isMe ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · You
                        </span>
                      ) : null}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.email}
                </TableCell>
                <TableCell>
                  <RoleBadge role={member.role} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(member.joinedAt)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {isMe && member.role === "owner" ? (
                      <span
                        title="Owners can't leave. Delete the organization instead."
                        className="px-2 text-xs text-muted-foreground/60"
                      >
                        Leave
                        <span className="sr-only">
                          {" "}
                          is not available: owners can&apos;t leave. Delete the
                          organization instead.
                        </span>
                      </span>
                    ) : null}
                    {isMe && member.role !== "owner" ? (
                      <Button variant="ghost" size="sm" onClick={onLeave}>
                        Leave
                      </Button>
                    ) : null}
                    {canChange ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Change role of ${name}`}
                        onClick={() => onChangeRole(member)}
                      >
                        Change role
                      </Button>
                    ) : null}
                    {canRemove ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove ${name}`}
                        onClick={() => onRemove(member)}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
