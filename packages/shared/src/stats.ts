import { z } from "zod";
import type { IssueStatus } from "./issues";

/**
 * Time windows of the statistics pages. Capped at 30 days on purpose: the queries
 * scan Event by (projectId, timestamp), and there is no retention job yet.
 * "24h" is bucketed by hour, every other range by day (UTC).
 */
export const STATS_RANGES = ["24h", "7d", "14d", "30d"] as const;
export type StatsRange = (typeof STATS_RANGES)[number];

export const DEFAULT_STATS_RANGE: StatsRange = "7d";

export const statsRangeSchema = z.enum(STATS_RANGES);

export const projectOverviewQuerySchema = z.object({
  range: statsRangeSchema.default(DEFAULT_STATS_RANGE),
});

export type ProjectOverviewQuery = z.infer<typeof projectOverviewQuerySchema>;

export interface OverviewCards {
  /** Events received in the range. */
  events: number;
  /** Events in the window of the same length right before the range, for the delta. */
  eventsPrevious: number;
  /** Issues that are unresolved right now (not limited to the range). */
  unresolved: number;
  /** Issues first seen in the range. */
  newIssues: number;
  /**
   * Issues whose latest regression is in the range. Approximate: only the last
   * regression of an issue is stored, not the history.
   */
  regressedIssues: number;
}

/** Events per time bucket and level. Empty buckets are present with zeros. */
export interface SeriesPoint {
  /** Start of the bucket, ISO 8601 UTC. */
  bucket: string;
  fatal: number;
  error: number;
  warning: number;
  info: number;
}

export interface EnvironmentCount {
  environment: string;
  count: number;
}

export interface TopIssue {
  id: string;
  title: string;
  type: string | null;
  level: string;
  status: IssueStatus;
  /** Events of this issue in the range (not the lifetime `eventCount`). */
  count: number;
  lastSeenAt: string;
}

export interface ProjectOverview {
  range: StatsRange;
  /** Start (inclusive) and end (exclusive) of the range, ISO 8601 UTC. */
  from: string;
  to: string;
  cards: OverviewCards;
  series: SeriesPoint[];
  environments: EnvironmentCount[];
  topIssues: TopIssue[];
}

/** The org overview takes the same range as the project overview. */
export const orgOverviewQuerySchema = projectOverviewQuerySchema;
export type OrgOverviewQuery = ProjectOverviewQuery;

export interface OrgProjectStat {
  id: string;
  name: string;
  /** Events received in the range. */
  events: number;
  /** Issues that are unresolved right now. */
  unresolved: number;
}

/** One bucket of the org chart: events per project id. Projects without events are absent. */
export interface OrgSeriesPoint {
  /** Start of the bucket, ISO 8601 UTC. */
  bucket: string;
  byProject: Record<string, number>;
}

export interface OrgTopIssue extends TopIssue {
  projectId: string;
  projectName: string;
}

export interface OrgOverview {
  range: StatsRange;
  /** Start (inclusive) and end (exclusive) of the range, ISO 8601 UTC. */
  from: string;
  to: string;
  /** Summed over every active project of the organization. */
  cards: OverviewCards;
  /** Every active project, busiest first, including those with no events. */
  projects: OrgProjectStat[];
  series: OrgSeriesPoint[];
  topIssues: OrgTopIssue[];
}
