"use client";

import { Loader2, ScrollText, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { AUDIT_ACTIONS } from "@errwise/shared";
import type { AuditAction, PublicAuditEntry } from "@errwise/shared";
import { EmptyState } from "@/components/shared/empty-state";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrg } from "@/features/organizations/use-current-org";
import { useProjects } from "@/features/projects/queries";
import { getErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { can } from "@/lib/permissions";
import { AUDIT_ACTION_LABELS, describeEntry } from "../describe-entry";
import { useAuditLog } from "../queries";

const ALL = "all";

const FILTER_ITEMS = [
  { value: ALL, label: "All actions" },
  ...AUDIT_ACTIONS.map((action) => ({
    value: action,
    label: AUDIT_ACTION_LABELS[action],
  })),
];

export function AuditLogView() {
  const { org } = useCurrentOrg();
  const allowed = !!org && can(org.role, "audit.read");
  const [action, setAction] = useState<AuditAction | null>(null);
  const log = useAuditLog(org?.id ?? "", action, allowed);
  const projects = useProjects(org?.id ?? "");

  const projectNames = useMemo(
    () => new Map((projects.data ?? []).map((p) => [p.id, p.name])),
    [projects.data],
  );

  if (!org) return null; // OrgGate guarantees this never happens

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {org.name} / Workspace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Who changed keys, members, invitations, projects and GitHub, newest
          first. Entries cannot be edited or deleted.
        </p>
      </header>

      {!allowed ? (
        // The API refuses members too (403): this only saves them a request.
        <EmptyState
          icon={ShieldAlert}
          title="Owners and admins only"
          description="Ask an owner or an admin of this organization if you need to know who changed something."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Select
              items={FILTER_ITEMS}
              value={action ?? ALL}
              onValueChange={(value) =>
                setAction(
                  !value || value === ALL ? null : (value as AuditAction),
                )
              }
            >
              <SelectTrigger className="w-64" aria-label="Filter by action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {log.isPending ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : log.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {getErrorMessage(log.error)}
            </p>
          ) : (
            <Entries
              entries={log.data.pages.flatMap((page) => page.items)}
              projectNames={projectNames}
              filtered={action !== null}
            />
          )}

          {log.hasNextPage ? (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => log.fetchNextPage()}
                disabled={log.isFetchingNextPage}
              >
                {log.isFetchingNextPage ? (
                  <Loader2 className="animate-spin" aria-hidden />
                ) : null}
                Load more
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Entries({
  entries,
  projectNames,
  filtered,
}: {
  entries: PublicAuditEntry[];
  projectNames: Map<string, string>;
  filtered: boolean;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title={filtered ? "Nothing of this kind yet" : "Nothing recorded yet"}
        description="Creating keys, inviting people or changing a project shows up here."
      />
    );
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {entries.map((entry) => {
        const actor = entry.actor
          ? (entry.actor.name ?? entry.actor.email)
          : "Deleted user";
        const projectName = entry.projectId
          ? (projectNames.get(entry.projectId) ?? null)
          : null;
        return (
          <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
            <InitialsAvatar label={actor} />
            <div className="min-w-0 flex-1">
              {/* Names come from people: React renders them as text, never as HTML. */}
              <p className="text-sm">
                <span className="font-medium">{actor}</span>{" "}
                <span className="text-muted-foreground">
                  {describeEntry(entry, projectName)}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                {entry.actor ? ` · ${entry.actor.email}` : ""}
              </p>
            </div>
            <time
              dateTime={entry.createdAt}
              title={new Date(entry.createdAt).toLocaleString()}
              className="shrink-0 text-xs text-muted-foreground"
            >
              {formatRelative(entry.createdAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
