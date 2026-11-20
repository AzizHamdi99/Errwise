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

/** An issue page shows a longer window by default than the overviews: it is a trend, not a status. */
export const DEFAULT_ISSUE_STATS_RANGE: StatsRange = "14d";

export const issueStatsQuerySchema = z.object({
  range: statsRangeSchema.default(DEFAULT_ISSUE_STATS_RANGE),
});

export type IssueStatsQuery = z.infer<typeof issueStatsQuerySchema>;

export interface CountPoint {
  /** Start of the bucket, ISO 8601 UTC. */
  bucket: string;
  count: number;
}

export interface ReleaseCount {
  /** Null groups the events that were sent without a release. */
  release: string | null;
  count: number;
}

export interface IssueStats {
  range: StatsRange;
  /** Start (inclusive) and end (exclusive) of the range, ISO 8601 UTC. */
  from: string;
  to: string;
  /** Events of this issue in the range. */
  total: number;
  /** Events per bucket. Empty buckets are present with zero. */
  series: CountPoint[];
  environments: EnvironmentCount[];
  releases: ReleaseCount[];
}

/** Deploys are rarer than errors, so the releases page looks further back by default. */
export const DEFAULT_RELEASES_RANGE: StatsRange = "30d";

export const releasesQuerySchema = z.object({
  range: statsRangeSchema.default(DEFAULT_RELEASES_RANGE),
});

export type ReleasesQuery = z.infer<typeof releasesQuerySchema>;

export interface ReleaseStat {
  /** Null groups the events that were sent without a release. */
  release: string | null;
  /** Events of this release received in the range. */
  events: number;
  /** Issues first seen in the range whose first release is this one. */
  newIssues: number;
  /** First and last event of this release inside the range, ISO 8601 UTC. */
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface ReleasesOverview {
  range: StatsRange;
  /** Start (inclusive) and end (exclusive) of the range, ISO 8601 UTC. */
  from: string;
  to: string;
  /** Most recently seen first, at most 20. */
  releases: ReleaseStat[];
}

export interface UsageProject {
  id: string;
  name: string;
  /** Events received over the last 30 days. */
  events: number;
}

export interface AiUsageStatus {
  /** AI analyses started today (UTC). A failed call gives its slot back. */
  usedToday: number;
  /** The organization's daily allowance. The day resets at 00:00 UTC. */
  dailyLimit: number;
}

export interface OrgUsage {
  /** The last 30 days, start (inclusive) and end (exclusive), ISO 8601 UTC. */
  from: string;
  to: string;
  totalEvents: number;
  /** Every active project, busiest first, including those with no events. */
  projects: UsageProject[];
  /** Events per day split by project, one point per day, zero-filled. */
  series: OrgSeriesPoint[];
  /** Null when the AI analysis feature is not configured, so the page can hide it. */
  ai: AiUsageStatus | null;
}
