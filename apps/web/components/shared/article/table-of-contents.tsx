"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  items: { id: string; title: string }[];
}

export function TableOfContents({ items }: Props) {
  const [active, setActive] = useState(items[0]?.id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActive(visible.target.id);
      },
      // A heading counts once it is in the top part of the window.
      { rootMargin: "-80px 0px -65% 0px" },
    );
    for (const { id } of items) {
      const heading = document.getElementById(id);
      if (heading) observer.observe(heading);
    }
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-3 font-medium">On this page</p>
      <ul className="space-y-2 border-l">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l border-transparent pl-4 transition-colors hover:text-foreground",
                active === item.id
                  ? "border-primary text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
