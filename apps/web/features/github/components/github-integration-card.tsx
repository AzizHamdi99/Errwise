"use client";

import { GitBranch, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api";
import {
  useDisconnectGithub,
  useGithubConnection,
  useGithubRepositories,
  useSelectGithubRepo,
  useStartGithubConnect,
} from "../use-github";

interface ProjectScope {
  orgId: string;
  projectId: string;
}

interface Props extends ProjectScope {
  canManage: boolean;
}

export function GithubIntegrationCard({ orgId, projectId, canManage }: Props) {
  const connection = useGithubConnection(orgId, projectId);

  let body: React.ReactNode;
  if (connection.isPending) {
    body = <Skeleton className="h-9 w-full" />;
  } else if (connection.isError) {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-destructive">
          {getErrorMessage(connection.error)}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => connection.refetch()}
        >
          Try again
        </Button>
      </div>
    );
  } else if (!connection.data.installed) {
    body = (
      <NotConnected orgId={orgId} projectId={projectId} canManage={canManage} />
    );
  } else if (canManage) {
    body = (
      <OwnerControls
        orgId={orgId}
        projectId={projectId}
        repo={connection.data.repo}
      />
    );
  } else {
    body = <ReadOnlyStatus repo={connection.data.repo} />;
  }

  return (
    <section aria-label="GitHub" className="rounded-xl border bg-card p-6">
      <header className="mb-6 flex items-start gap-3">
        <GitBranch
          className="mt-0.5 size-5 text-muted-foreground"
          aria-hidden
        />
        <div>
          <h2 className="text-base font-semibold">GitHub</h2>
          <p className="text-sm text-muted-foreground">
            Create a GitHub issue from an error in one click.
          </p>
        </div>
      </header>
      {body}
    </section>
  );
}

function NotConnected({ orgId, projectId, canManage }: Props) {
  const connect = useStartGithubConnect(orgId, projectId);

  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        GitHub is not connected. Ask the organization owner to connect it.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">
        You will be sent to GitHub to choose which repositories Errwise can use.
        Only issue access is requested.
      </p>
      <Button
        onClick={() =>
          connect.mutate(undefined, {
            onError: (error) => toast.error(getErrorMessage(error)),
          })
        }
        disabled={connect.isPending || connect.isSuccess}
      >
        {connect.isPending || connect.isSuccess ? (
          <Loader2 className="animate-spin" aria-hidden />
        ) : null}
        Connect GitHub
      </Button>
    </div>
  );
}

function ReadOnlyStatus({ repo }: { repo: string | null }) {
  return (
    <p className="text-sm text-muted-foreground">
      {repo ? (
        <>
          Issues are created in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
            {repo}
          </code>
          . Only the organization owner can change this.
        </>
      ) : (
        "GitHub is connected, but the organization owner has not chosen a repository yet."
      )}
    </p>
  );
}

function OwnerControls({
  orgId,
  projectId,
  repo,
}: ProjectScope & { repo: string | null }) {
  const repos = useGithubRepositories(orgId, projectId, true);
  const select = useSelectGithubRepo(orgId, projectId);
  const disconnect = useDisconnectGithub(orgId, projectId);
  const updateAccess = useStartGithubConnect(orgId, projectId);

  function onSelect(fullName: string) {
    select.mutate(fullName, {
      onSuccess: () => toast.success(`Issues will be created in ${fullName}`),
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  }

  function onDisconnect() {
    disconnect.mutate(undefined, {
      onSuccess: () => toast("GitHub disconnected"),
      onError: (error) => toast.error(getErrorMessage(error)),
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Repository</label>
        {repos.isPending ? (
          <Skeleton className="h-9 w-full" />
        ) : repos.isError ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-destructive">
              {getErrorMessage(repos.error)}
            </p>
            <Button variant="outline" size="sm" onClick={() => repos.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <Select
            value={repo ?? ""}
            onValueChange={onSelect}
            disabled={select.isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a repository" />
            </SelectTrigger>
            <SelectContent>
              {repos.data.map((r) => (
                <SelectItem key={r.fullName} value={r.fullName}>
                  {r.fullName}
                  {r.private ? " · private" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-muted-foreground">
          Only the owner can change this. Everyone else uses it to create
          issues.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            updateAccess.mutate(undefined, {
              onError: (error) => toast.error(getErrorMessage(error)),
            })
          }
          disabled={updateAccess.isPending || updateAccess.isSuccess}
        >
          Repository missing? Update GitHub access
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDisconnect}
          disabled={disconnect.isPending}
        >
          Disconnect
        </Button>
      </div>
    </div>
  );
}
