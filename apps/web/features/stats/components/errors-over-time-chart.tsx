"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { SeriesPoint, StatsRange } from "@errwise/shared";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { bucketLabel } from "../bucket-label";

const LEVELS = ["fatal", "error", "warning", "info"] as const;

const config = {
  fatal: { label: "Fatal", color: "var(--destructive)" },
  error: { label: "Error", color: "var(--chart-4)" },
  warning: { label: "Warning", color: "var(--chart-2)" },
  info: { label: "Info", color: "var(--chart-3)" },
} satisfies ChartConfig;

interface Props {
  series: SeriesPoint[];
  range: StatsRange;
}

export function ErrorsOverTimeChart({ series, range }: Props) {
  const label = bucketLabel(range);

  return (
    <ChartContainer config={config} className="h-64 w-full">
      <AreaChart data={series} margin={{ left: 0, right: 8, top: 8 }}>
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
                  payload?.[0]?.payload as SeriesPoint | undefined
                )?.bucket;
                return bucket ? `${label(bucket)} UTC` : "";
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        {LEVELS.map((level) => (
          <Area
            key={level}
            dataKey={level}
            type="monotone"
            stackId="events"
            stroke={`var(--color-${level})`}
            fill={`var(--color-${level})`}
            fillOpacity={0.35}
            strokeWidth={1.5}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
