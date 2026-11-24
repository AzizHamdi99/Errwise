"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { SearchEntry } from "../types";

const MAX_RESULTS = 8;

function search(index: SearchEntry[], query: string): SearchEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return index
    .filter((entry) => {
      const text = `${entry.page} ${entry.section ?? ""}`.toLowerCase();
      return words.every((word) => text.includes(word));
    })
    .slice(0, MAX_RESULTS);
}

export function DocsSearch({ index }: { index: SearchEntry[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const results = search(index, query);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function change(next: boolean) {
    setOpen(next);
    setQuery("");
    setSelected(0);
  }

  function go(entry: SearchEntry | undefined) {
    if (!entry) return;
    change(false);
    router.push(entry.href);
  }

  function onInputKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const last = Math.max(0, results.length - 1);
      setSelected((value) => Math.min(last, Math.max(0, value + step)));
    }
    if (event.key === "Enter") go(results[selected]);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => change(true)}
        className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-sm text-muted-foreground hover:border-primary/50"
      >
        <Search aria-hidden className="size-4" />
        Search docs
        <kbd className="ml-auto rounded border px-1.5 font-mono text-[11px]">
          Ctrl K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={change}>
        <DialogContent className="top-24 translate-y-0 gap-0 p-0">
          <DialogTitle className="sr-only">Search the docs</DialogTitle>
          <DialogDescription className="sr-only">
            Type to search, use the arrow keys to choose and Enter to open.
          </DialogDescription>
          <input
            autoFocus
            role="combobox"
            aria-label="Search"
            aria-expanded={results.length > 0}
            aria-controls="docs-search-results"
            aria-activedescendant={
              results[selected] ? `docs-result-${selected}` : undefined
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search pages and headings"
            className="h-12 w-full border-b bg-transparent px-4 pr-12 text-sm outline-none"
          />
          <ul
            id="docs-search-results"
            role="listbox"
            aria-label="Results"
            className="max-h-80 overflow-y-auto p-2"
          >
            {results.map((entry, position) => (
              <li
                key={entry.href}
                id={`docs-result-${position}`}
                role="option"
                aria-selected={position === selected}
                onMouseMove={() => setSelected(position)}
                onClick={() => go(entry)}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-2 text-sm",
                  position === selected && "bg-muted",
                )}
              >
                {entry.section ?? entry.page}
                {entry.section ? (
                  <span className="ml-2 text-muted-foreground">
                    {entry.page}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          {results.length === 0 ? (
            <p role="status" className="px-5 pb-5 text-sm text-muted-foreground">
              Nothing found.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
