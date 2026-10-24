import { CheckCircle2, Inbox, SearchX } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import type { IssueFilters } from "../use-issue-filters";

interface Props {
  filters: IssueFilters;
  apiKeysHref: string;
  onClear: () => void;
  onShowAll: () => void;
}

const FLAT = "rounded-none border-0";

export function IssuesEmptyState({
  filters,
  apiKeysHref,
  onClear,
  onShowAll,
}: Props) {
  const filtered =
    !!filters.environment ||
    !!filters.search ||
    filters.status === "resolved" ||
    filters.status === "ignored";

  if (filtered) {
    return (
      <EmptyState
        icon={SearchX}
        title="No issues match your filters"
        description="Try a different search, environment or status."
        action={
          <Button variant="outline" onClick={onClear}>
            Clear filters
          </Button>
        }
        className={FLAT}
      />
    );
  }

  const showingAll = filters.status === "all";
  return (
    <EmptyState
      icon={showingAll ? Inbox : CheckCircle2}
      title={showingAll ? "No errors yet" : "No unresolved issues"}
      description="New errors from your SDK appear here as soon as they arrive."
      action={
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href={apiKeysHref}>Set up the SDK</Link>
          </Button>
          {showingAll ? null : (
            <Button variant="outline" onClick={onShowAll}>
              Show all issues
            </Button>
          )}
        </div>
      }
      className={FLAT}
    />
  );
}
