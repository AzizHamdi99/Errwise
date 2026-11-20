"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type {
  OrgProjectStat,
  OrgSeriesPoint,
  StatsRange,
} from "@errwise/shared";
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
  projects: OrgProjectStat[];
  range: StatsRange;
}

export function ErrorsByProjectChart({ series, projects, range }: Props) {
  const { config, keys, data } = groupSeriesByProject(series, projects);
  const label = bucketLabel(range);

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
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
          content={
            <ChartTooltipContent
              indicator="line"
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
        {keys.map((key) => (
          <Area
            key={key}
            dataKey={key}
            type="monotone"
            stackId="events"
            stroke={`var(--color-${key})`}
            fill={`var(--color-${key})`}
            fillOpacity={0.35}
            strokeWidth={1.5}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
