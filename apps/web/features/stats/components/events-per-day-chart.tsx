"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { OrgSeriesPoint, UsageProject } from "@errwise/shared";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { bucketLabel } from "../bucket-label";
import { groupSeriesByProject, type ProjectSeriesRow } from "../project-series";

interface Props {
  series: OrgSeriesPoint[];
  /** Busiest first, as the API returns them. */
  projects: UsageProject[];
}

const label = bucketLabel("30d");

export function EventsPerDayChart({ series, projects }: Props) {
  const { config, keys, data } = groupSeriesByProject(series, projects);

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="bucket"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tickFormatter={label}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={32}
          allowDecimals={false}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const bucket = (
                  payload?.[0]?.payload as ProjectSeriesRow | undefined
                )?.bucket;
                return typeof bucket === "string" ? `${label(bucket)} UTC` : "";
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {keys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            stackId="events"
            fill={`var(--color-${key})`}
            // Only the top of the stack is rounded, or the segments would show gaps.
            radius={index === keys.length - 1 ? [3, 3, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
