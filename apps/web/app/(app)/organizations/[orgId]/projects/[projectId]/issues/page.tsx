import type { Metadata } from "next";
import { Suspense } from "react";
import { IssuesView } from "@/features/issues/components/issues-view";

export const instant = false;
export const metadata: Metadata = { title: "Issues" };

export default function IssuesPage() {
  return (
    <Suspense>
      <IssuesView />
    </Suspense>
  );
}
