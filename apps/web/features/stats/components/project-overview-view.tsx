"use client";

import { BarChart3, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { TopIssue } from "@errwise/shared";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectPageHeader } from "@/features/projects/components/project-page-header";
import { useCurrentProject } from "@/features/projects/use-current-project";
import { getErrorMessage } from "@/lib/api";
import { useProjectOverview } from "../queries";
import { useStatsRange } from "../use-stats-range";
import { EnvironmentDonut } from "./environment-donut";
import { ErrorsOverTimeChart } from "./errors-over-time-chart";
import { RangeSelect, rangeLabel } from "./range-select";
import { StatCard } from "./stat-card";
import { TopIssuesTable } from "./top-issues-table";

function Panel({
  title,
  description,
  children,
  flush,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** No padding around the body, for lists that go edge to edge. */
  flush?: boolean;
}) {
  return (
    <section aria-label={title} className="rounded-xl border bg-card">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className={flush ? undefined : "p-4"}>{children}</div>
    </section>
  );
}

export function ProjectOverviewView() {
  const { org, project } = useCurrentProject();
  const { range, setRange } = useStatsRange();
  const query = useProjectOverview(org?.id ?? "", project?.id ?? "", range);

  if (!org || !project) return null; // ProjectGate guarantees this never happens

  const base = `/organizations/${org.id}/projects/${project.id}`;
  const issueHref = (issue: TopIssue) => `${base}/issues/${issue.id}`;
  const data = query.data;
  const hint = `last ${rangeLabel(range).toLowerCase()}`;

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
  } else if (data.cards.events === 0) {
    body = (
      <EmptyState
        icon={BarChart3}
        title="No events in this range"
        description="Nothing was reported in this period. Pick a longer range, or check that your SDK is sending events."
        action={
          <Button
            variant="outline"
            render={<Link href={`${base}/api-keys`} />}
            nativeButton={false}
          >
            Open API keys
          </Button>
        }
      />
    );
  } else {
    body = (
      <div className="space-y-6">
        <Panel
          title="Errors over time"
          description="Events per period by level. Times are in UTC."
        >
          <ErrorsOverTimeChart series={data.series} range={data.range} />
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Environments" description="Where the events came from.">
            <EnvironmentDonut environments={data.environments} />
          </Panel>
          <Panel
            title="Top issues"
            description="Most events in this range."
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
      <ProjectPageHeader
        title="Overview"
        description="How this project is doing right now."
        actions={<RangeSelect value={range} onChange={setRange} />}
      />

      <section
        aria-label="Summary"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <StatCard
          label="Events"
          value={data?.cards.events}
          hint={hint}
          delta={
            data
              ? {
                  current: data.cards.events,
                  previous: data.cards.eventsPrevious,
                }
              : undefined
          }
        />
        <StatCard
          label="Unresolved issues"
          value={data?.cards.unresolved}
          hint="right now"
        />
        <StatCard
          label="New issues"
          value={data?.cards.newIssues}
          hint={hint}
        />
        <StatCard
          label="Regressed issues"
          value={data?.cards.regressedIssues}
          hint={`${hint}, approx.`}
        />
      </section>

      {body}
    </div>
  );
}
