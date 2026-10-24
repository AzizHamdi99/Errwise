"use client";

import { KeyRound, Plus, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { CreatedApiKey, PublicApiKey } from "@errwise/shared";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectPageHeader } from "@/features/projects/components/project-page-header";
import { useCurrentProject } from "@/features/projects/use-current-project";
import { getErrorMessage } from "@/lib/api";
import { can } from "@/lib/permissions";
import { useApiKeys } from "../queries";
import { ApiKeysTable } from "./api-keys-table";
import { CreateKeyDialog } from "./create-key-dialog";
import { KeyRevealDialog } from "./key-reveal-dialog";
import { RevokeKeyDialog } from "./revoke-key-dialog";

/** Mirrors the limit enforced by the API. */
const MAX_ACTIVE_KEYS = 10;

export function ApiKeysView() {
  const { org, project } = useCurrentProject();
  const {
    data: keys,
    isPending,
    isError,
    error,
    refetch,
  } = useApiKeys(org?.id ?? "", project?.id ?? "");
  const [createOpen, setCreateOpen] = useState(false);
  const [revealed, setRevealed] = useState<CreatedApiKey | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PublicApiKey | null>(null);

  if (!org || !project) return null; // ProjectGate guarantees this never happens

  const canWrite = can(org.role, "apiKey.write");
  const activeCount = keys?.filter((key) => !key.revokedAt).length ?? 0;
  const limitReached = activeCount >= MAX_ACTIVE_KEYS;

  const createButton = canWrite ? (
    <Button onClick={() => setCreateOpen(true)} disabled={limitReached}>
      <Plus aria-hidden />
      Create key
    </Button>
  ) : null;

  let body: React.ReactNode;
  if (isPending) {
    body = <Skeleton className="h-48 rounded-xl" aria-busy="true" />;
  } else if (isError) {
    body = (
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load API keys"
        description={getErrorMessage(error)}
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        }
      />
    );
  } else if (keys.length === 0) {
    body = (
      <EmptyState
        icon={KeyRound}
        title="No API keys yet"
        description={
          canWrite
            ? "Create a key to start sending errors from your SDK."
            : "Ask an owner of this organization to create a key."
        }
        action={createButton}
      />
    );
  } else {
    body = (
      <ApiKeysTable
        keys={keys}
        canWrite={canWrite}
        onRevoke={setRevokeTarget}
      />
    );
  }

  return (
    <div className="space-y-8">
      <ProjectPageHeader
        title="Project settings"
        description="Manage project access, keys and event retention."
        kind="Project"
      />

      <section aria-labelledby="keys-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h2 id="keys-title" className="text-lg font-medium">
              API keys
            </h2>
            <p className="text-sm text-muted-foreground">
              Use a project key to send events from your SDK.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {limitReached && canWrite ? (
              <p className="text-xs text-muted-foreground">
                Limit of {MAX_ACTIVE_KEYS} active keys reached. Revoke one to
                create another.
              </p>
            ) : null}
            {createButton}
          </div>
        </div>

        {body}
      </section>

      <CreateKeyDialog
        orgId={org.id}
        projectId={project.id}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(key) => {
          setCreateOpen(false);
          setRevealed(key);
        }}
      />
      <KeyRevealDialog
        apiKey={revealed}
        platform={project.platform}
        onClose={() => setRevealed(null)}
      />
      <RevokeKeyDialog
        orgId={org.id}
        projectId={project.id}
        apiKey={revokeTarget}
        onClose={() => setRevokeTarget(null)}
      />
    </div>
  );
}
