"use client";

import { CheckCircle2, Eye, EyeOff, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { IssueListItem, PublicIssue } from "@errwise/shared";
import { RelativeTime } from "@/components/shared/relative-time";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { IssueSparkline } from "./issue-sparkline";
import { IssueStatusBadge, issueStatusMeta } from "./issue-status-badge";

/** The API title is "Type: message", so split it to style the two parts. */
function splitTitle(issue: PublicIssue) {
  if (issue.type && issue.title.startsWith(`${issue.type}: `)) {
    return {
      type: issue.type,
      message: issue.title.slice(issue.type.length + 2),
    };
  }
  return { type: null, message: issue.title };
}

interface Props {
  issue: IssueListItem;
  href: string;
  active: boolean;
  /** Ticked for a bulk action. Independent of `active`, the row the keyboard is on. */
  selected: boolean;
  onActivate: () => void;
  onToggleSelected: (issue: PublicIssue) => void;
  onToggleResolved: (issue: PublicIssue) => void;
  onToggleIgnored: (issue: PublicIssue) => void;
}

export function IssueRow({
  issue,
  href,
  active,
  selected,
  onActivate,
  onToggleSelected,
  onToggleResolved,
  onToggleIgnored,
}: Props) {
  const { icon: StatusIcon, text } = issueStatusMeta(issue.status);
  const { type, message } = splitTitle(issue);
  const resolved = issue.status === "resolved";
  const ignored = issue.status === "ignored";

  const details = [
    issue.environments.join(", "),
    issue.lastRelease ? `release ${issue.lastRelease}` : null,
    `first seen ${formatRelative(issue.firstSeenAt)}`,
  ].filter(Boolean);

  return (
    <li
      id={`issue-${issue.id}`}
      className={cn(
        "group relative flex items-start gap-3 border-b px-4 py-3 transition-colors last:border-b-0 hover:bg-accent/40",
        selected && "bg-accent/40",
        active && "bg-accent/60",
      )}
    >
      {/* above the link that covers the whole row, so a click ticks it instead of opening the issue */}
      <Checkbox
        checked={selected}
        onCheckedChange={() => onToggleSelected(issue)}
        aria-label={`Select issue: ${issue.title}`}
        className="relative z-10 mt-0.5"
      />

      <StatusIcon className={cn("mt-0.5 size-4 shrink-0", text)} aria-hidden />

      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="truncate text-sm">
          <Link
            href={href}
            onFocus={onActivate}
            className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
          >
            {type ? <span className="font-semibold">{type} </span> : null}
            <span className="text-muted-foreground">{message}</span>
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <span>{details.join(" · ")}</span>
          <IssueStatusBadge status={issue.status} />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* quick actions: visible on hover or keyboard focus, hidden on touch screens */}
        <div className="relative z-10 hidden items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 sm:flex">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={resolved ? "Reopen issue" : "Resolve issue"}
            title={resolved ? "Reopen" : "Resolve"}
            onClick={() => onToggleResolved(issue)}
          >
            {resolved ? (
              <RotateCcw aria-hidden />
            ) : (
              <CheckCircle2 aria-hidden />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={ignored ? "Stop ignoring issue" : "Ignore issue"}
            title={ignored ? "Stop ignoring" : "Ignore"}
            onClick={() => onToggleIgnored(issue)}
          >
            {ignored ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
          </Button>
        </div>

        {/* hidden on narrow screens: the row has no room for it next to the count */}
        <IssueSparkline
          counts={issue.trend24h}
          className="mr-2 hidden md:block"
        />

        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold tabular-nums">
            {issue.eventCount.toLocaleString()}
          </span>
          <RelativeTime
            iso={issue.lastSeenAt}
            style="narrow"
            className="w-14 text-right text-xs text-muted-foreground"
          />
        </div>
      </div>
    </li>
  );
}
