"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  DEFAULT_ISSUE_STATS_RANGE,
  type CountPoint,
  type StatsRange,
} from "@errwise/shared";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/api";
import { bucketLabel } from "../bucket-label";
import { useIssueStats } from "../queries";
import { RangeSelect, rangeLabel } from "./range-select";

const config = {
  count: { label: "Events", color: "var(--chart-1)" },
} satisfies ChartConfig;

const MAX_ROWS = 5;

interface Props {
  orgId: string;
  projectId: string;
  issueId: string;
}

interface Row {
  key: string;
  label: string;
  count: number;
}

function Breakdown({ title, rows }: { title: string; rows: Row[] }) {
  const shown = rows.slice(0, MAX_ROWS);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (shown.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="space-y-2">
        {shown.map((row) => (
          <li key={row.key} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{row.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {row.count.toLocaleString("en")}
                <span className="ml-1.5 text-xs">
                  {Math.round((row.count / total) * 100)}%
                </span>
              </span>
            </div>
            <div className="h-1 rounded-full bg-muted" aria-hidden>
              <div
                className="h-1 rounded-full bg-primary"
                style={{ width: `${(row.count / total) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventsChart({
  series,
  range,
}: {
  series: CountPoint[];
  range: StatsRange;
}) {
  const label = bucketLabel(range);
  return (
    <ChartContainer config={config} className="h-36 w-full">
      <BarChart data={series} margin={{ left: 0, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          minTickGap={28}
          tickFormatter={label}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideIndicator
              labelFormatter={(_, payload) => {
                const bucket = (payload?.[0]?.payload as CountPoint | undefined)
                  ?.bucket;
                return bucket ? `${label(bucket)} UTC` : "";
              }}
            />
          }
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export function IssueActivityCard({ orgId, projectId, issueId }: Props) {
  const [range, setRange] = useState<StatsRange>(DEFAULT_ISSUE_STATS_RANGE);
  const query = useIssueStats(orgId, projectId, issueId, range);
  const data = query.data;

  let body: React.ReactNode;
  if (query.isError && !data) {
    body = (
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <span>{getErrorMessage(query.error)}</span>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    );
  } else if (!data) {
    body = <Skeleton className="h-52 w-full" aria-busy="true" />;
  } else if (data.total === 0) {
    body = (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No events of this issue in the last {rangeLabel(range).toLowerCase()}.
      </p>
    );
  } else {
    body = (
      <div className="space-y-5">
        <EventsChart series={data.series} range={data.range} />
        <div className="grid gap-5 sm:grid-cols-2">
          <Breakdown
            title="Environments"
            rows={data.environments.map((item) => ({
              key: item.environment,
              label: item.environment,
              count: item.count,
            }))}
          />
          <Breakdown
            title="Releases"
            rows={data.releases.map((item) => ({
              key: item.release ?? "none",
              label: item.release ?? "No release",
              count: item.count,
            }))}
          />
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Activity" className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-medium">Activity</h2>
          <p className="text-xs text-muted-foreground">
            {data
              ? `${data.total.toLocaleString("en")} events in the last ${rangeLabel(range).toLowerCase()}. Times are in UTC.`
              : "Events of this issue over time."}
          </p>
        </div>
        <RangeSelect value={range} onChange={setRange} />
      </header>
      <div className="p-4">{body}</div>
    </section>
  );
}
