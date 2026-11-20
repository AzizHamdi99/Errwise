import type { ReleaseStat } from "@errwise/shared";
import { RelativeTime } from "@/components/shared/relative-time";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function ReleasesTable({ releases }: { releases: ReleaseStat[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Release</TableHead>
          <TableHead className="text-right">Events</TableHead>
          <TableHead className="text-right">New issues</TableHead>
          <TableHead className="hidden sm:table-cell">First seen</TableHead>
          <TableHead className="text-right">Last seen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {releases.map((item) => (
          <TableRow key={item.release ?? "none"}>
            <TableCell
              className={cn(
                "max-w-[16rem] truncate font-mono text-xs",
                item.release === null &&
                  "font-sans italic text-muted-foreground",
              )}
            >
              {item.release ?? "No release"}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {item.events.toLocaleString("en")}
            </TableCell>
            <TableCell
              className={cn(
                "text-right tabular-nums",
                item.newIssues > 0
                  ? "font-medium text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {item.newIssues}
            </TableCell>
            <TableCell className="hidden text-muted-foreground sm:table-cell">
              <RelativeTime iso={item.firstSeenAt} />
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              <RelativeTime iso={item.lastSeenAt} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
