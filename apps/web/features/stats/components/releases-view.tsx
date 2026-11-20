"use client";

import { Info, Rocket, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { DEFAULT_RELEASES_RANGE } from "@errwise/shared";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectPageHeader } from "@/features/projects/components/project-page-header";
import { useCurrentProject } from "@/features/projects/use-current-project";
import { getErrorMessage } from "@/lib/api";
import { useReleases } from "../queries";
import { useStatsRange } from "../use-stats-range";
import { Panel } from "./panel";
import { RangeSelect, rangeLabel } from "./range-select";
import { ReleasesChart } from "./releases-chart";
import { ReleasesTable } from "./releases-table";

export function ReleasesView() {
  const { org, project } = useCurrentProject();
  const { range, setRange } = useStatsRange(DEFAULT_RELEASES_RANGE);
  const query = useReleases(org?.id ?? "", project?.id ?? "", range);

  if (!org || !project) return null; // ProjectGate guarantees this never happens

  const base = `/organizations/${org.id}/projects/${project.id}`;
  const data = query.data;
  const onlyUnversioned =
    !!data &&
    data.releases.length > 0 &&
    data.releases.every((item) => item.release === null);
  const hasNewIssues =
    !!data && data.releases.some((item) => item.newIssues > 0);

  let body: React.ReactNode;
  if (query.isError && !data) {
    body = (
      <EmptyState
        icon={TriangleAlert}
        title="Couldn't load the releases"
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
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    );
  } else if (data.releases.length === 0) {
    body = (
      <EmptyState
        icon={Rocket}
        title="No events in this range"
        description={`Nothing was reported in the last ${rangeLabel(range).toLowerCase()}, so there are no releases to compare.`}
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
        {onlyUnversioned ? (
          <p className="flex items-start gap-2 rounded-xl border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              None of your events carry a release. Set{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                release
              </code>{" "}
              when you start the SDK, or the{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                ERRWISE_RELEASE
              </code>{" "}
              environment variable, to compare your deploys.
            </span>
          </p>
        ) : null}

        <Panel
          title="New issues per release"
          description="Issues first seen in this range, by the release that introduced them."
        >
          {hasNewIssues ? (
            <ReleasesChart releases={data.releases} />
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No new issues in this range.
            </p>
          )}
        </Panel>

        <Panel
          title="All releases"
          description="Most recently seen first. Counts cover this range only."
          flush
        >
          <ReleasesTable releases={data.releases} />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ProjectPageHeader
        title="Releases"
        description="Which deploy brought new errors."
        actions={<RangeSelect value={range} onChange={setRange} />}
      />
      {body}
    </div>
  );
}
