"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription, useUpdateSubscription } from "../queries";
import { NotifyButton } from "./notify-button";

interface Props {
  orgId: string;
  projectId: string;
}

export function NotifyToggle({ orgId, projectId }: Props) {
  const { data, isPending, isError } = useSubscription(orgId, projectId);
  const update = useUpdateSubscription(orgId, projectId);

  if (isPending) return <Skeleton className="h-8 w-36 rounded-md" />;
  if (isError) return null; // not essential: never block the page

  const on = data.emailNewIssues;

  return (
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
  );
}
