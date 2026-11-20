"use client";

import { Cell, Pie, PieChart } from "recharts";
import type { EnvironmentCount } from "@errwise/shared";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const colorAt = (index: number) => PALETTE[index % PALETTE.length];

export function EnvironmentDonut({
  environments,
}: {
  environments: EnvironmentCount[];
}) {
  const total = environments.reduce((sum, item) => sum + item.count, 0);
  const config: ChartConfig = Object.fromEntries(
    environments.map((item, index) => [
      item.environment,
      { label: item.environment, color: colorAt(index) },
    ]),
  );

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <ChartContainer config={config} className="size-44 shrink-0">
        <PieChart>
          <ChartTooltip
            content={<ChartTooltipContent hideLabel nameKey="environment" />}
          />
          <Pie
            data={environments}
            dataKey="count"
            nameKey="environment"
            innerRadius="62%"
            strokeWidth={2}
          >
            {environments.map((item, index) => (
              <Cell key={item.environment} fill={colorAt(index)} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <ul className="w-full space-y-2 text-sm">
        {environments.map((item, index) => (
          <li key={item.environment} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colorAt(index) }}
              aria-hidden
            />
            <span className="truncate">{item.environment}</span>
            <span className="ml-auto tabular-nums text-muted-foreground">
              {item.count}
              <span className="ml-1.5 text-xs">
                {total > 0 ? Math.round((item.count / total) * 100) : 0}%
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
