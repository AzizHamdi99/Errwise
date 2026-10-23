"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useCurrentOrg } from "@/features/organizations/use-current-org";
import { SidebarContent } from "./sidebar";

const SECTIONS: Record<string, string> = {
  projects: "Projects",
  members: "Members",
  settings: "Settings",
};

export function Topbar() {
  const [open, setOpen] = useState(false);
  const { org } = useCurrentOrg();
  // /organizations/:orgId/:section/...
  const section = SECTIONS[usePathname().split("/")[3] ?? ""];

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
            />
          }
        >
          <Menu aria-hidden />
        </SheetTrigger>

        <SheetContent side="left" className="w-[280px] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Main navigation
          </SheetDescription>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {org ? (
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-2 text-sm"
        >
          <span className="truncate text-muted-foreground">{org.name}</span>
          {section ? (
            <>
              <span aria-hidden className="text-muted-foreground">
                /
              </span>
              <span className="font-medium">{section}</span>
            </>
          ) : null}
        </nav>
      ) : null}
    </header>
  );
}
