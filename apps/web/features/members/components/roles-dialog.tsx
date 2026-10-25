import type { OrgRole } from "@errwise/shared";
import { RoleBadge } from "@/components/shared/role-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ROLES: { role: OrgRole; abilities: string[] }[] = [
  {
    role: "owner",
    abilities: [
      "Everything an admin can do",
      "Create, edit and delete projects",
      "Create and revoke API keys",
      "Invite admins, change roles and remove admins",
      "Delete the organization",
    ],
  },
  {
    role: "admin",
    abilities: [
      "Everything a member can do",
      "Invite members and manage their invitations",
      "Remove members",
      "Rename the organization",
    ],
  },
  {
    role: "member",
    abilities: [
      "View projects, issues and members",
      "Resolve and ignore issues",
    ],
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RolesDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Roles and permissions</DialogTitle>
          <DialogDescription>
            What each role can do in this organization.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {ROLES.map(({ role, abilities }) => (
            <section key={role} className="space-y-2">
              <RoleBadge role={role} />
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {abilities.map((ability) => (
                  <li key={ability}>{ability}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
