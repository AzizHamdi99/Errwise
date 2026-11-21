"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EVENT_LEVELS,
  ISSUE_AGES,
  ISSUE_SORTS,
  type IssueAge,
  type IssueSort,
} from "@errwise/shared";
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

const SORT_LABELS: Record<IssueSort, string> = {
  lastSeen: "Last seen",
  firstSeen: "First seen",
  events: "Most events",
};

const AGE_LABELS: Record<IssueAge, string> = {
  "24h": "New in 24 hours",
  "7d": "New in 7 days",
};

const ALL = "all";

interface Option {
  value: string;
  label: string;
}

interface FilterSelectProps {
  ariaLabel: string;
  value: string | undefined;
  /** What the select shows, and the first choice, when nothing is selected. */
  allLabel: string;
  options: Option[];
  onChange: (value: string | undefined) => void;
  className: string;
}

/** A select with an "all" choice first. A selected value missing from the options is still shown. */
function FilterSelect({
  ariaLabel,
  value,
  allLabel,
  options,
  onChange,
  className,
}: FilterSelectProps) {
  const shown =
    value && !options.some((option) => option.value === value)
      ? [...options, { value, label: value }]
      : options;
  const current = shown.find((option) => option.value === value);

  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) =>
        onChange(next === null || next === ALL ? undefined : next)
      }
    >
      <SelectTrigger
        className={cn("w-full cursor-pointer", className)}
        aria-label={ariaLabel}
      >
        <SelectValue>{current?.label ?? allLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL} className="cursor-pointer">
          {allLabel}
        </SelectItem>
        {shown.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="cursor-pointer"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const toOptions = (values: string[]): Option[] =>
  values.map((value) => ({ value, label: value }));

interface Props {
  filters: IssueFilters;
  /** From the project's own data (the facets), not a fixed list. */
  environments: string[];
  releases: string[];
  onChange: (patch: Partial<IssueFilters>) => void;
  /** Changing it remounts the search box, which clears its text. */
  searchKey: number;
  searchRef: React.Ref<HTMLInputElement>;
}

export function IssuesFilters({
  filters,
  environments,
  releases,
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
              "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
              filters.status === status && "bg-accent text-foreground",
            )}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      <FilterSelect
        ariaLabel="Environment"
        value={filters.environment}
        allLabel="All environments"
        options={toOptions(environments)}
        onChange={(environment) => onChange({ environment })}
        className="sm:w-[180px]"
      />

      <FilterSelect
        ariaLabel="Level"
        value={filters.level}
        allLabel="All levels"
        options={EVENT_LEVELS.map((level) => ({ value: level, label: level }))}
        onChange={(level) =>
          onChange({ level: EVENT_LEVELS.find((l) => l === level) })
        }
        className="sm:w-[140px] capitalize"
      />

      <FilterSelect
        ariaLabel="Introduced in release"
        value={filters.release}
        allLabel="All releases"
        options={toOptions(releases)}
        onChange={(release) => onChange({ release })}
        className="sm:w-[170px]"
      />

      <FilterSelect
        ariaLabel="Issue age"
        value={filters.age}
        allLabel="Any age"
        options={ISSUE_AGES.map((age) => ({
          value: age,
          label: AGE_LABELS[age],
        }))}
        onChange={(age) => onChange({ age: ISSUE_AGES.find((a) => a === age) })}
        className="sm:w-[170px]"
      />

      <button
        type="button"
        aria-pressed={filters.regressed}
        onClick={() => onChange({ regressed: !filters.regressed })}
        className={cn(
          "rounded-lg border px-3 py-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
          filters.regressed && "bg-accent text-foreground",
        )}
      >
        Regressed
      </button>

      <FilterSelect
        ariaLabel="Sort by"
        // the default is the select's first choice ("all"), so it is not an option of its own
        value={filters.sort === "lastSeen" ? undefined : filters.sort}
        allLabel={SORT_LABELS.lastSeen}
        options={ISSUE_SORTS.filter((sort) => sort !== "lastSeen").map(
          (sort) => ({ value: sort, label: SORT_LABELS[sort] }),
        )}
        onChange={(sort) =>
          onChange({ sort: ISSUE_SORTS.find((s) => s === sort) ?? "lastSeen" })
        }
        className="sm:w-[150px]"
      />

      <SearchInput
        key={searchKey}
        ref={searchRef}
        initial={filters.search}
        onSearch={(search) => onChange({ search })}
      />
    </div>
  );
}
