import type { UsageProject } from "@errwise/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  projects: UsageProject[];
  /** Events received today (UTC) per project id. */
  todayByProject: Record<string, number>;
  totalEvents: number;
}

export function UsageTable({ projects, todayByProject, totalEvents }: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project</TableHead>
          <TableHead className="text-right">Today</TableHead>
          <TableHead className="text-right">30 days</TableHead>
          <TableHead className="hidden w-40 sm:table-cell">Share</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => {
          const share = totalEvents > 0 ? project.events / totalEvents : 0;
          return (
            <TableRow key={project.id}>
              <TableCell className="max-w-[16rem] truncate font-medium">
                {project.name}
              </TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {(todayByProject[project.id] ?? 0).toLocaleString("en")}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {project.events.toLocaleString("en")}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <div className="flex items-center gap-2">
                  <div className="h-1 flex-1 rounded-full bg-muted" aria-hidden>
                    <div
                      className="h-1 rounded-full bg-primary"
                      style={{ width: `${share * 100}%` }}
                    />
                  </div>
                  <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                    {Math.round(share * 100)}%
                  </span>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
