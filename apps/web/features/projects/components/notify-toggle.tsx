"use client";

import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription, useUpdateSubscription } from "../queries";

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
      <Button
        variant={on ? "secondary" : "outline"}
        size="sm"
        aria-pressed={on}
        disabled={update.isPending}
        onClick={() => update.mutate({ emailNewIssues: !on })}
        title={
          on
            ? "You get an email for each new issue. Click to turn off."
            : "Get an email when a new issue appears in this project."
        }
      >
        {on ? (
          <Bell aria-hidden className="text-primary" />
        ) : (
          <BellOff aria-hidden />
        )}
        {on ? "Notifications on" : "Notify me"}
      </Button>
      {update.isError ? (
        <p role="alert" className="text-xs text-destructive">
          Couldn&apos;t update. Try again.
        </p>
      ) : null}
    </div>
  );
}
