import type { Metadata } from "next";
import { Suspense } from "react";
import { OrgOverviewView } from "@/features/stats/components/org-overview-view";

export const metadata: Metadata = { title: "Overview" };

export default function OrgOverviewPage() {
  return (
    <Suspense>
      <OrgOverviewView />
    </Suspense>
  );
}
