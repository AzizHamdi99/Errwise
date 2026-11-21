import { z } from "zod";
import { idSchema } from "./common";
import { EVENT_LEVELS } from "./events";
import type { GithubIssueLink } from "./github";

export const ISSUE_STATUSES = ["unresolved", "resolved", "ignored"] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

/**
 * Every sort is "descending, then id descending". The values only ever grow (lastSeenAt and
 * eventCount) or never change (firstSeenAt), so a row can move toward the top of the list but
 * never down: paging with a cursor cannot show a row twice.
 */
export const ISSUE_SORTS = ["lastSeen", "firstSeen", "events"] as const;
export type IssueSort = (typeof ISSUE_SORTS)[number];
export const DEFAULT_ISSUE_SORT: IssueSort = "lastSeen";

/** "New issues": first seen within this window. */
export const ISSUE_AGES = ["24h", "7d"] as const;
export type IssueAge = (typeof ISSUE_AGES)[number];

/** A query-string boolean. `z.coerce.boolean()` would turn the text "false" into true. */
const queryBoolean = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const listIssuesQuerySchema = z.object({
  status: z.enum(ISSUE_STATUSES).optional(),
  environment: z.string().trim().min(1).max(64).optional(),
  level: z.enum(EVENT_LEVELS).optional(),
  /** The release the issue was first seen in ("introduced in"), not the latest one. */
  release: z.string().trim().min(1).max(128).optional(),
  /** Only issues that came back after being resolved. */
  regressed: queryBoolean.optional(),
  age: z.enum(ISSUE_AGES).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(ISSUE_SORTS).default(DEFAULT_ISSUE_SORT),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const updateIssueSchema = z.object({
  status: z.enum(ISSUE_STATUSES),
});

/** One request changes at most this many issues; the dashboard splits a larger selection. */
export const MAX_BULK_ISSUES = 100;

export const bulkUpdateIssuesSchema = z.object({
  issueIds: z
    .array(idSchema)
    .min(1)
    .max(MAX_BULK_ISSUES)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "issueIds must not contain duplicates",
    }),
  status: z.enum(ISSUE_STATUSES),
});

export interface BulkUpdateIssuesResult {
  /**
   * How many issues really changed. Fewer than requested is normal: an issue that already had
   * the status, or that is not in this project, is skipped without an error.
   */
  updated: number;
}

export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;
export type BulkUpdateIssuesInput = z.infer<typeof bulkUpdateIssuesSchema>;

/** The values the list filters can offer, read from the project's own data. */
export interface IssueFacets {
  /** Most issues first. */
  environments: string[];
  /** Newest first, by when the release first showed up in an issue. */
  releases: string[];
}

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
  github: GithubIssueLink | null;
}

/** How many hourly buckets the list's trend has. */
export const TREND_HOURS = 24;

/** An issue as the list shows it: the issue, plus how busy it was lately. */
export interface IssueListItem extends PublicIssue {
  /**
   * Events per hour for the last TREND_HOURS hours, oldest first, always TREND_HOURS values.
   * Hours are UTC hours; the last value is the current hour, which is not over yet.
   * The detail and the status update do not carry it.
   */
  trend24h: number[];
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
  /** The deployed Git commit, lowercase hex, when the SDK or the release provided one. */
  commitSha: string | null;
  sdk: string | null;
  context: Record<string, unknown> | null;
  timestamp: string;
  receivedAt: string;
}

export interface IssueDetail extends PublicIssue {
  events: PublicEvent[];
}
