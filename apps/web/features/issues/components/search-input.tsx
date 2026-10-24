"use client";

import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  initial: string;
  onSearch: (value: string) => void;
  ref?: React.Ref<HTMLInputElement>;
}

export function SearchInput({ initial, onSearch, ref }: Props) {
  const [text, setText] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(onSearch);

  useEffect(() => {
    latest.current = onSearch;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  function change(value: string) {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => latest.current(value), 300);
  }

  function clear() {
    clearTimeout(timer.current);
    setText("");
    latest.current("");
  }

  return (
    <div className="relative min-w-[200px] flex-1">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={ref}
        value={text}
        onChange={(event) => change(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            clear();
            event.currentTarget.blur();
          }
        }}
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        placeholder="Search issues"
        aria-label="Search issues"
        className="px-9"
      />
      {text ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
