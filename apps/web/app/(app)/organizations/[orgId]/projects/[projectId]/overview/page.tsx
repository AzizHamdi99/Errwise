import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectOverviewView } from "@/features/stats/components/project-overview-view";

export const instant = false;
export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return (
    <Suspense>
      <ProjectOverviewView />
    </Suspense>
  );
}
