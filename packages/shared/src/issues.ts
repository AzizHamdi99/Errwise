import { z } from "zod";

export const ISSUE_STATUSES = ["unresolved", "resolved", "ignored"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const listIssuesQuerySchema = z.object({
  status: z.enum(ISSUE_STATUSES).optional(),
  environment: z.string().trim().min(1).max(64).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const updateIssueSchema = z.object({
  status: z.enum(ISSUE_STATUSES),
});

export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;

export interface Paginated<T> {
  items: T[];
  /** Pass it as `cursor` to get the next page. Null on the last page. */
  nextCursor: string | null;
}

export interface PublicIssue {
  id: string;
  projectId: string;
  title: string;
  type: string | null;
  level: string;
  status: IssueStatus;
  eventCount: number;
  environments: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  firstRelease: string | null;
  lastRelease: string | null;
  resolvedAt: string | null;
}

export interface PublicEvent {
  id: string;
  eventId: string;
  level: string;
  type: string | null;
  message: string;
  stack: string | null;
  platform: string;
  environment: string;
  release: string | null;
  sdk: string | null;
  context: Record<string, unknown> | null;
  timestamp: string;
  receivedAt: string;
}

export interface IssueDetail extends PublicIssue {
  events: PublicEvent[];
}
