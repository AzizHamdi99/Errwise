"use client";

import type { PublicOrganization } from "@errwise/shared";
import { TypeToConfirmDialog } from "@/components/shared/type-to-confirm-dialog";
import { getErrorMessage } from "@/lib/api";
import { clearLastOrgId } from "@/lib/last-org";
import { useDeleteOrganization } from "../queries";

interface Props {
  org: PublicOrganization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteOrganizationDialog({ org, open, onOpenChange }: Props) {
  const remove = useDeleteOrganization(org.id);
  // after success the page is about to reload, so keep the dialog locked
  const busy = remove.isPending || remove.isSuccess;

  function handleOpenChange(next: boolean) {
    if (busy) return;
    if (!next) remove.reset();
    onOpenChange(next);
  }

  function confirm() {
    remove.mutate(undefined, {
      onSuccess: () => {
        clearLastOrgId(org.id);
        // A full load drops every cached query of the deleted organization
        // and avoids a flash of "Organization not found" on this page.
        window.location.assign("/organizations");
      },
    });
  }

  return (
    <TypeToConfirmDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Delete organization"
      description={`You are about to delete ${org.name}. This can't be undone from the dashboard.`}
      consequences={[
        "Projects and API keys stop working immediately.",
        "Apps using those keys stop reporting errors.",
        "Every member loses access to this organization.",
      ]}
      confirmText={org.name}
      actionLabel="Delete organization"
      pendingLabel="Deleting…"
      isPending={busy}
      error={remove.isError ? getErrorMessage(remove.error) : null}
      onConfirm={confirm}
    />
  );
}
