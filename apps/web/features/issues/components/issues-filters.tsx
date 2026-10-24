"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { STATUS_FILTERS } from "../use-issue-filters";
import type { IssueFilters, StatusFilter } from "../use-issue-filters";
import { SearchInput } from "./search-input";

const STATUS_LABELS: Record<StatusFilter, string> = {
  unresolved: "Unresolved",
  resolved: "Resolved",
  ignored: "Ignored",
  all: "All",
};

interface Props {
  filters: IssueFilters;
  environments: string[];
  onChange: (patch: Partial<IssueFilters>) => void;
  /** Changing it remounts the search box, which clears its text. */
  searchKey: number;
  searchRef: React.Ref<HTMLInputElement>;
}

export function IssuesFilters({
  filters,
  environments,
  onChange,
  searchKey,
  searchRef,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="group"
        aria-label="Filter by status"
        className="inline-flex rounded-lg border bg-background/40 p-0.5"
      >
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={filters.status === status}
            onClick={() => onChange({ status })}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              filters.status === status && "bg-accent text-foreground",
            )}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <Select
        value={filters.environment ?? "all"}
        onValueChange={(value) =>
          onChange({ environment: value === "all" ? undefined : value })
        }
      >
        <SelectTrigger className="w-full sm:w-[190px]" aria-label="Environment">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All environments</SelectItem>
          {environments.map((environment) => (
            <SelectItem key={environment} value={environment}>
              {environment}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <SearchInput
        key={searchKey}
        ref={searchRef}
        initial={filters.search}
        onSearch={(search) => onChange({ search })}
      />
    </div>
  );
}
