"use client";

import type { PublicEvent } from "@errwise/shared";
import { StackTraceCard } from "@/features/issues/components/stack-trace-card";
import { useSourceContext } from "../queries";
import { buildSourceView } from "../source-view";

interface Props {
  orgId: string;
  projectId: string;
  issueId: string;
  event: PublicEvent;
  /** The project's switch. */
  sourceEnabled: boolean;
  canManage: boolean;
}

/** Fetches the code for one event and hands it to the stack trace. Key it by event id. */
export function StackTraceWithSource({
  orgId,
  projectId,
  issueId,
  event,
  sourceEnabled,
  canManage,
}: Props) {
  const query = useSourceContext({
    orgId,
    projectId,
    issueId,
    eventId: event.id,
    enabled: sourceEnabled && event.commitSha !== null,
  });

  const view = buildSourceView({
    sourceEnabled,
    canManage,
    commitSha: event.commitSha,
    integrationsHref: `/organizations/${orgId}/projects/${projectId}/integrations`,
    query: {
      isLoading: query.isLoading,
      isError: query.isError,
      data: query.data,
    },
  });

  return (
    <StackTraceCard
      stack={event.stack}
      message={event.message}
      sourceFrames={view.frames}
      sourceLoading={view.loading}
      banner={view.banner}
      onRetry={() => void query.refetch()}
    />
  );
}
