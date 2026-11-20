import Link from "next/link";
import type { TopIssue } from "@errwise/shared";
import { RelativeTime } from "@/components/shared/relative-time";
import { IssueStatusBadge } from "@/features/issues/components/issue-status-badge";

/** The organization overview adds the project the issue belongs to. */
type Row = TopIssue & { projectName?: string };

interface Props<T extends Row> {
  issues: T[];
  hrefFor: (issue: T) => string;
}

export function TopIssuesTable<T extends Row>({ issues, hrefFor }: Props<T>) {
  const max = Math.max(1, ...issues.map((issue) => issue.count));

  return (
    <ul className="divide-y">
      {issues.map((issue) => (
        <li key={issue.id}>
          <Link
            href={hrefFor(issue)}
            className="flex items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/60"
          >
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="truncate text-sm font-medium">{issue.title}</p>
              {issue.projectName ? (
                <p className="truncate text-xs text-muted-foreground">
                  {issue.projectName}
                </p>
              ) : null}
              {/* The bar is relative to the busiest issue, so the list reads as a ranking. */}
              <div
                className="h-1 rounded-full bg-muted"
                role="presentation"
                aria-hidden
              >
                <div
                  className="h-1 rounded-full bg-primary"
                  style={{ width: `${(issue.count / max) * 100}%` }}
                />
              </div>
            </div>
            <div className="hidden shrink-0 sm:block">
              <IssueStatusBadge status={issue.status} />
            </div>
            <div className="w-24 shrink-0 text-right">
              <p className="text-sm font-medium tabular-nums">
                {issue.count.toLocaleString("en")}
                <span className="sr-only"> events</span>
              </p>
              <RelativeTime
                iso={issue.lastSeenAt}
                style="narrow"
                className="text-xs text-muted-foreground"
              />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
