import type { InvitationPreview } from "@errwise/shared";
import { Eyebrow } from "@/components/shared/eyebrow";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { RelativeTime } from "@/components/shared/relative-time";
import { RoleBadge } from "@/components/shared/role-badge";

interface Props {
  preview: InvitationPreview;
  children: React.ReactNode;
}

export function InvitationCard({ preview, children }: Props) {
  const inviter = preview.inviterName ?? "Someone";

  return (
    <section
      aria-labelledby="invitation-title"
      className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-[0_0_60px_-24px_var(--primary)]"
    >
      <InitialsAvatar
        label={preview.organizationName}
        max={1}
        className="size-12 rounded-xl text-base"
      />

      <div className="mt-6 space-y-3">
        <Eyebrow>Organization invitation</Eyebrow>
        <h1
          id="invitation-title"
          className="text-2xl font-medium leading-tight tracking-tight text-balance"
        >
          {inviter} invited you to join {preview.organizationName}
        </h1>
        <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <RoleBadge role={preview.role} />
          <span>
            Expires <RelativeTime iso={preview.expiresAt} />
          </span>
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4 rounded-lg border bg-background/40 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Invited email
          </p>
          <p className="truncate text-sm font-medium">{preview.email}</p>
        </div>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
          {preview.organizationName} workspace
        </span>
      </div>

      <div className="mt-6 space-y-4">{children}</div>
    </section>
  );
}
