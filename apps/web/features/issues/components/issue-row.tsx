"use client";

import { CheckCircle2, Eye, EyeOff, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { PublicIssue } from "@errwise/shared";
import { RelativeTime } from "@/components/shared/relative-time";
import { Button } from "@/components/ui/button";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
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
  issue: PublicIssue;
  href: string;
  active: boolean;
  onActivate: () => void;
  onToggleResolved: (issue: PublicIssue) => void;
  onToggleIgnored: (issue: PublicIssue) => void;
}

export function IssueRow({
  issue,
  href,
  active,
  onActivate,
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
        active && "bg-accent/60",
      )}
    >
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
