"use client";

import type { IssueStatus } from "@errwise/shared";
import { Button } from "@/components/ui/button";

const OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: "unresolved", label: "Unresolved" },
  { value: "resolved", label: "Resolved" },
  { value: "ignored", label: "Ignored" },
];

export function IssueStatusControl({
  status,
  pending,
  onChange,
}: {
  status: IssueStatus;
  pending: boolean;
  onChange: (status: IssueStatus) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Issue status"
      className="inline-flex rounded-lg border bg-card p-0.5"
    >
      {OPTIONS.map((option) => (
        <Button
          key={option.value}
          type="button"
          size="sm"
          variant={option.value === status ? "secondary" : "ghost"}
          aria-pressed={option.value === status}
          disabled={pending}
          onClick={() => {
            if (option.value !== status) onChange(option.value);
          }}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
