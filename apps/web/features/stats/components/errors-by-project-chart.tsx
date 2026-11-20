"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type {
  OrgProjectStat,
  OrgSeriesPoint,
  StatsRange,
} from "@errwise/shared";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

// The palette has five colours. The busiest four projects get one each and every
// other project is merged into "Other", so the chart never needs a sixth hue.
const NAMED_SLOTS = 4;
const SLOT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];
const OTHER_KEY = "other";

const hourFormat = new Intl.DateTimeFormat("en", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});
const dayFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

interface Props {
  series: OrgSeriesPoint[];
  /** Busiest first, as the API returns them. */
  projects: OrgProjectStat[];
  range: StatsRange;
}

type Row = { bucket: string } & Record<string, number | string>;

export function ErrorsByProjectChart({ series, projects, range }: Props) {
  // Keys are slot names, not project ids: ids start with a digit, which is awkward in CSS variable names.
  const named = projects.slice(0, NAMED_SLOTS);
  const slotOf = new Map(named.map((project, i) => [project.id, `p${i}`]));
  const hasOther = projects.length > NAMED_SLOTS;

  const config: ChartConfig = {
    ...Object.fromEntries(
      named.map((project, i) => [
        `p${i}`,
        { label: project.name, color: SLOT_COLORS[i] },
      ]),
    ),
    ...(hasOther
      ? { [OTHER_KEY]: { label: "Other", color: "var(--muted-foreground)" } }
      : {}),
  };
  const keys = Object.keys(config);

  const data: Row[] = series.map((point) => {
    const row: Row = { bucket: point.bucket };
    for (const key of keys) row[key] = 0;
    for (const [projectId, count] of Object.entries(point.byProject)) {
      const key = slotOf.get(projectId) ?? OTHER_KEY;
      if (key in row) row[key] = (row[key] as number) + count;
    }
    return row;
  });

  const format = range === "24h" ? hourFormat : dayFormat;
  const label = (bucket: string) => format.format(new Date(bucket));

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
                const bucket = (payload?.[0]?.payload as Row | undefined)
                  ?.bucket;
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
