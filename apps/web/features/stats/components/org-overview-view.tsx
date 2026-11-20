"use client";

import { BarChart3, FolderPlus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { OrgTopIssue } from "@errwise/shared";
import { EmptyState } from "@/components/shared/empty-state";
import { Eyebrow } from "@/components/shared/eyebrow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrg } from "@/features/organizations/use-current-org";
import { getErrorMessage } from "@/lib/api";
import { useOrgOverview } from "../queries";
import { useStatsRange } from "../use-stats-range";
import { ErrorsByProjectChart } from "./errors-by-project-chart";
import { EventsByProjectChart } from "./events-by-project-chart";
import { Panel } from "./panel";
import { RangeSelect } from "./range-select";
import { SummaryCards } from "./summary-cards";
import { TopIssuesTable } from "./top-issues-table";

export function OrgOverviewView() {
  const { org } = useCurrentOrg();
  const { range, setRange } = useStatsRange();
  const query = useOrgOverview(org?.id ?? "", range);

  if (!org) return null; // OrgGate guarantees this never happens

  const base = `/organizations/${org.id}`;
  const issueHref = (issue: OrgTopIssue) =>
    `${base}/projects/${issue.projectId}/issues/${issue.id}`;
  const data = query.data;

  let body: React.ReactNode;
  if (query.isError && !data) {
    body = (
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load the overview"
        description={getErrorMessage(query.error)}
        action={
          <Button variant="outline" onClick={() => query.refetch()}>
            Try again
          </Button>
        }
      />
    );
  } else if (!data) {
    body = (
      <div aria-busy="true" className="space-y-6">
        <Skeleton className="h-80 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  } else if (data.projects.length === 0) {
    body = (
      <EmptyState
        icon={FolderPlus}
        title="No projects yet"
        description="Create a project to start collecting errors, and its numbers will show up here."
        action={
          <Button
            render={<Link href={`${base}/projects`} />}
            nativeButton={false}
          >
            Go to projects
          </Button>
        }
      />
    );
  } else if (data.cards.events === 0) {
    body = (
      <EmptyState
        icon={BarChart3}
        title="No events in this range"
        description="Nothing was reported in this period. Pick a longer range, or check that your SDKs are sending events."
        action={
          <Button
            variant="outline"
            render={<Link href={`${base}/projects`} />}
            nativeButton={false}
          >
            Open projects
          </Button>
        }
      />
    );
  } else {
    body = (
      <div className="space-y-6">
        <Panel
          title="Errors over time"
          description="Events per period, split by project. Times are in UTC."
        >
          <ErrorsByProjectChart
            series={data.series}
            projects={data.projects}
            range={data.range}
          />
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Events per project" description="Busiest first.">
            <EventsByProjectChart projects={data.projects} />
          </Panel>
          <Panel
            title="Top issues"
            description="Most events in this range, across all projects."
            flush
          >
            <TopIssuesTable issues={data.topIssues} hrefFor={issueHref} />
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <Eyebrow>{org.name} / Workspace</Eyebrow>
          <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            How all your projects are doing right now.
          </p>
        </div>
        <RangeSelect value={range} onChange={setRange} />
      </header>

      <SummaryCards cards={data?.cards} range={range} />

      {body}
    </div>
  );
}
