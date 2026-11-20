"use client";

import { BarChart3, FolderPlus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Eyebrow } from "@/components/shared/eyebrow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrg } from "@/features/organizations/use-current-org";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useOrgUsage } from "../queries";
import { AiQuotaCard } from "./ai-quota-card";
import { EventsPerDayChart } from "./events-per-day-chart";
import { Panel } from "./panel";
import { StatCard } from "./stat-card";
import { UsageTable } from "./usage-table";

export function UsageView() {
  const { org } = useCurrentOrg();
  const query = useOrgUsage(org?.id ?? "");

  if (!org) return null; // OrgGate guarantees this never happens

  const base = `/organizations/${org.id}`;
  const data = query.data;

  // The last bucket is today (UTC), so "today" needs no extra query.
  const todayByProject = data?.series.at(-1)?.byProject ?? {};
  const eventsToday = Object.values(todayByProject).reduce(
    (sum, count) => sum + count,
    0,
  );
  const activeProjects = data?.projects.filter((p) => p.events > 0).length;

  let body: React.ReactNode;
  if (query.isError && !data) {
    body = (
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load the usage"
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
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  } else if (data.projects.length === 0) {
    body = (
      <EmptyState
        icon={FolderPlus}
        title="No projects yet"
        description="Create a project to start collecting errors, and its usage will show up here."
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
  } else {
    body = (
      <div className="space-y-6">
        <Panel
          title="Events per day"
          description="The last 30 days, split by project. Days are in UTC."
        >
          {data.totalEvents === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No events in the last 30 days"
              description="Check that your SDKs are sending events."
              className="border-0 py-10"
            />
          ) : (
            <EventsPerDayChart series={data.series} projects={data.projects} />
          )}
        </Panel>

        <Panel title="By project" description="Busiest first." flush>
          <UsageTable
            projects={data.projects}
            todayByProject={todayByProject}
            totalEvents={data.totalEvents}
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <Eyebrow>{org.name} / Workspace</Eyebrow>
        <h1 className="text-3xl font-semibold tracking-tight">Usage</h1>
        <p className="text-sm text-muted-foreground">
          What your projects send, and how much of the AI allowance is left.
        </p>
      </header>

      <section
        aria-label="Summary"
        className={cn(
          "grid grid-cols-2 gap-4",
          data?.ai ? "lg:grid-cols-4" : "lg:grid-cols-3",
        )}
      >
        <StatCard
          label="Events"
          value={data?.totalEvents}
          hint="last 30 days"
        />
        <StatCard
          label="Events today"
          value={data ? eventsToday : undefined}
          hint="since 00:00 UTC"
        />
        <StatCard
          label="Active projects"
          value={activeProjects}
          hint={data ? `of ${data.projects.length}` : undefined}
        />
        {/* Hidden, not zeroed, when the AI feature is not configured. */}
        {data?.ai ? <AiQuotaCard ai={data.ai} /> : null}
      </section>

      {body}
    </div>
  );
}
