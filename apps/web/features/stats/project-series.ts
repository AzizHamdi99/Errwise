import type { OrgSeriesPoint } from "@errwise/shared";
import type { ChartConfig } from "@/components/ui/chart";

// The palette has five colours. The busiest four projects get one each and every
// other project is merged into "Other", so a chart never needs a sixth hue.
const NAMED_SLOTS = 4;
const SLOT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];
const OTHER_KEY = "other";

export type ProjectSeriesRow = { bucket: string } & Record<
  string,
  number | string
>;

export interface ProjectSeries {
  config: ChartConfig;
  /** Series keys in stacking order: the busiest project first, "other" last. */
  keys: string[];
  data: ProjectSeriesRow[];
}

/**
 * Turns the API's per-project buckets into flat rows for a stacked chart.
 * `projects` must be busiest first, as the API returns them.
 */
export function groupSeriesByProject(
  series: OrgSeriesPoint[],
  projects: { id: string; name: string }[],
): ProjectSeries {
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

  const data = series.map((point) => {
    const row: ProjectSeriesRow = { bucket: point.bucket };
    for (const key of keys) row[key] = 0;
    for (const [projectId, count] of Object.entries(point.byProject)) {
      const key = slotOf.get(projectId) ?? OTHER_KEY;
      if (key in row) row[key] = (row[key] as number) + count;
    }
    return row;
  });

  return { config, keys, data };
}
