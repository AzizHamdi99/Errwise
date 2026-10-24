"use client";

import { useEffect, useRef } from "react";

interface Handlers {
  onMove: (delta: 1 | -1) => void;
  onOpen: () => void;
  onResolve: () => void;
  onIgnore: () => void;
  onSearch: () => void;
}

// Never steal keys from form fields, open menus or dialogs.
const IGNORED_TARGETS =
  'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="option"], [role="menu"], [role="dialog"]';

export function useIssueShortcuts(handlers: Handlers) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.defaultPrevented
      )
        return;
      const target = event.target as HTMLElement | null;
      if (target?.closest(IGNORED_TARGETS)) return;

      const h = latest.current;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          h.onMove(1);
          break;
        case "ArrowUp":
          event.preventDefault();
          h.onMove(-1);
          break;
        case "Enter":
          // links and buttons handle Enter themselves
          if (target === document.body) h.onOpen();
          break;
        case "r":
          if (!event.repeat) h.onResolve();
          break;
        case "i":
          if (!event.repeat) h.onIgnore();
          break;
        case "/":
          event.preventDefault();
          h.onSearch();
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
