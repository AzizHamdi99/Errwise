"use client";

import Link from "next/link";
import type { PublicProject } from "@errwise/shared";
import { NotifyButton } from "@/features/projects/components/notify-button";
import { getPlatform } from "@/features/projects/platforms";
import { useUpdateSubscription } from "@/features/projects/queries";

interface Props {
  orgId: string;
  project: PublicProject;
  on: boolean;
}

export function AlertRow({ orgId, project, on }: Props) {
  const update = useUpdateSubscription(orgId, project.id);

  return (
    <li className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <Link
          href={`/organizations/${orgId}/projects/${project.id}/overview`}
          className="truncate rounded-sm text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {project.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {getPlatform(project.platform).label}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <NotifyButton
          on={on}
          pending={update.isPending}
          onToggle={() => update.mutate({ emailNewIssues: !on })}
        />
        {update.isError ? (
          <p role="alert" className="text-xs text-destructive">
            Couldn&apos;t update. Try again.
          </p>
        ) : null}
      </div>
    </li>
  );
}
