"use client";

import { Bar, BarChart, XAxis, YAxis } from "recharts";
import type { OrgProjectStat } from "@errwise/shared";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const MAX_BARS = 8;
const ROW_HEIGHT = 36;

const config = {
  events: { label: "Events", color: "var(--chart-1)" },
} satisfies ChartConfig;

interface Props {
  projects: OrgProjectStat[];
}

export function EventsByProjectChart({ projects }: Props) {
  const shown = projects.slice(0, MAX_BARS);
  const hidden = projects.length - shown.length;

  return (
    <div className="space-y-3">
      <ChartContainer
        config={config}
        className="w-full"
        style={{ height: shown.length * ROW_HEIGHT + 16 }}
      >
        <BarChart
          data={shown}
          layout="vertical"
          margin={{ left: 0, right: 16, top: 0, bottom: 0 }}
        >
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            width={110}
            tickFormatter={(name: string) =>
              name.length > 16 ? `${name.slice(0, 15)}…` : name
            }
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Bar
            dataKey="events"
            fill="var(--color-events)"
            radius={4}
            barSize={16}
          />
        </BarChart>
      </ChartContainer>

      {/* The chart is a picture; this list is what screen reader users get. */}
      <ul className="sr-only">
        {shown.map((project) => (
          <li key={project.id}>
            {project.name}: {project.events} events, {project.unresolved}{" "}
            unresolved issues
          </li>
        ))}
      </ul>

      {hidden > 0 ? (
        <p className="text-xs text-muted-foreground">
          and {hidden} more {hidden === 1 ? "project" : "projects"} with fewer
          events
        </p>
      ) : null}
    </div>
  );
}
