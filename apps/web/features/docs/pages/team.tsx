import { DocTable } from "@/components/shared/article/doc-table";
import type { DocPage } from "../types";

const YES = "Yes";
const NO = "No";

export const team: DocPage = {
  slug: "team",
  title: "Team, roles and invitations",
  description: "Who can do what in an organization.",
  sections: [
    {
      id: "roles",
      title: "Roles",
      body: (
        <DocTable
          head={["Action", "Member", "Admin", "Owner"]}
          rows={[
            ["View projects, issues and members", YES, YES, YES],
            ["Resolve and ignore issues", YES, YES, YES],
            ["Create a GitHub issue", YES, YES, YES],
            ["Ask for an analysis or a fix", YES, YES, YES],
            ["Open a fix as a draft pull request", NO, YES, YES],
            ["Rename the organization", NO, YES, YES],
            ["Read the audit log", NO, YES, YES],
            ["Invite and remove", NO, "Members only", "Admins and members"],
            ["Change roles", NO, NO, YES],
            ["Create, edit and delete projects", NO, NO, YES],
            ["Create and revoke API keys", NO, NO, YES],
            ["Connect GitHub, turn on source code and fixes", NO, NO, YES],
            ["Delete the organization", NO, NO, YES],
          ]}
        />
      ),
    },
    {
      id: "invitations",
      title: "Invitations",
      body: (
        <p>
          Invite by email from the <strong>Members</strong> page. The link is
          valid for 7 days. A pending invitation can be sent again or revoked.
        </p>
      ),
    },
    {
      id: "audit",
      title: "Audit log",
      body: (
        <p>
          Owners and admins can see who changed keys, members, invitations,
          projects, GitHub and the organization name. Keys and tokens are never
          written there.
        </p>
      ),
    },
    {
      id: "sessions",
      title: "Your account",
      body: (
        <p>
          The account page lists your sessions and lets you revoke them. Changing
          your password signs out every other session.
        </p>
      ),
    },
  ],
};
