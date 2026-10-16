import type { Event, Issue } from '@prisma/client';
import { ISSUE_STATUSES } from '@errwise/shared';
import type { IssueStatus, PublicEvent, PublicIssue } from '@errwise/shared';

/** `status` is a plain string in the database, so validate it here. */
export function toIssueStatus(value: string): IssueStatus {
  return (ISSUE_STATUSES as readonly string[]).includes(value)
    ? (value as IssueStatus)
    : 'unresolved';
}

export function toPublicIssue(
  issue: Issue,
  environments: string[] = [],
): PublicIssue {
  return {
    id: issue.id,
    projectId: issue.projectId,
    title: issue.title,
    type: issue.type,
    level: issue.level,
    status: toIssueStatus(issue.status),
    eventCount: issue.eventCount,
    environments,
    firstSeenAt: issue.firstSeenAt.toISOString(),
    lastSeenAt: issue.lastSeenAt.toISOString(),
    firstRelease: issue.firstRelease,
    lastRelease: issue.lastRelease,
    resolvedAt: issue.resolvedAt?.toISOString() ?? null,
  };
}

export function toPublicEvent(event: Event): PublicEvent {
  return {
    id: event.id,
    eventId: event.eventId,
    level: event.level,
    type: event.type,
    message: event.message,
    stack: event.stack,
    platform: event.platform,
    environment: event.environment,
    release: event.release,
    sdk: event.sdk,
    context: event.context as Record<string, unknown> | null,
    timestamp: event.timestamp.toISOString(),
    receivedAt: event.receivedAt.toISOString(),
  };
}
