"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { ReleaseStat } from "@errwise/shared";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const MAX_BARS = 8;

const config = {
  newIssues: { label: "New issues", color: "var(--chart-1)" },
} satisfies ChartConfig;

export const releaseName = (release: string | null) => release ?? "No release";

const short = (name: string) =>
  name.length > 14 ? `${name.slice(0, 13)}…` : name;

export function ReleasesChart({ releases }: { releases: ReleaseStat[] }) {
  // The API sends the newest first; a timeline reads left to right, oldest first.
  const data = releases
    .slice(0, MAX_BARS)
    .reverse()
    .map((item) => ({ name: releaseName(item.release), ...item }));

  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={0}
          tickFormatter={short}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideIndicator />}
        />
        <Bar
          dataKey="newIssues"
          fill="var(--color-newIssues)"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ChartContainer>
  );
}
