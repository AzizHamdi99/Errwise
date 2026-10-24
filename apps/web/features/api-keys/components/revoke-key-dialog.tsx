"use client";

import { toast } from "sonner";
import type { PublicApiKey } from "@errwise/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { getErrorMessage } from "@/lib/api";
import { useRevokeApiKey } from "../queries";

interface Props {
  orgId: string;
  projectId: string;
  apiKey: PublicApiKey | null;
  onClose: () => void;
}

export function RevokeKeyDialog({ orgId, projectId, apiKey, onClose }: Props) {
  const revoke = useRevokeApiKey(orgId, projectId);

  return (
    <ConfirmDialog
      open={!!apiKey}
      onOpenChange={(open) => {
        if (open) return;
        revoke.reset();
        onClose();
      }}
      title="Revoke API key"
      description={
        apiKey
          ? `Apps using “${apiKey.name}” (${apiKey.prefix}…) will stop sending errors immediately.`
          : ""
      }
      actionLabel="Revoke key"
      pendingLabel="Revoking…"
      isPending={revoke.isPending}
      error={revoke.isError ? getErrorMessage(revoke.error) : null}
      onConfirm={() => {
        if (!apiKey) return;
        revoke.mutate(apiKey.id, {
          onSuccess: () => {
            toast.success("API key revoked");
            onClose();
          },
        });
      }}
    />
  );
}
