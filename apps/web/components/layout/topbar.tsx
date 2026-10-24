"use client";

import { Menu } from "lucide-react";
import { useParams, usePathname } from "next/navigation";
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
import { useProjects } from "@/features/projects/queries";
import { SidebarContent } from "./sidebar";

const ORG_SECTIONS: Record<string, string> = {
  projects: "Projects",
  members: "Members",
  settings: "Settings",
};
// API keys live inside the project settings in the design
const PROJECT_SECTIONS: Record<string, string> = {
  issues: "Issues",
  "api-keys": "Settings",
  settings: "Settings",
};

export function Topbar() {
  const [open, setOpen] = useState(false);
  const { org } = useCurrentOrg();
  const { projectId } = useParams<{ projectId?: string }>();
  // the project list is only needed on project pages
  const { data: projects } = useProjects(projectId ? (org?.id ?? "") : "");
  // /organizations/:orgId/:section/:projectId/:page
  const segments = usePathname().split("/");
  const project = projects?.find((p) => p.id === projectId);

  const crumbs = !org
    ? []
    : project
      ? [org.name, project.name, PROJECT_SECTIONS[segments[5] ?? ""]]
      : [org.name, ORG_SECTIONS[segments[3] ?? ""]];
  const trail = crumbs.filter((crumb): crumb is string => Boolean(crumb));

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Open menu"
          >
            <Menu aria-hidden />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Main navigation
          </SheetDescription>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {trail.length > 0 ? (
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex items-center gap-2 text-sm">
            {trail.map((crumb, index) => {
              const last = index === trail.length - 1;
              return (
                <li
                  key={`${index}-${crumb}`}
                  className="flex min-w-0 items-center gap-2"
                >
                  {index > 0 ? (
                    <span aria-hidden className="text-muted-foreground">
                      /
                    </span>
                  ) : null}
                  <span
                    aria-current={last ? "page" : undefined}
                    className={
                      last
                        ? "truncate font-medium"
                        : "truncate text-muted-foreground"
                    }
                  >
                    {crumb}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>
      ) : null}
    </header>
  );
}
