import type { Metadata } from "next";
import { Suspense } from "react";
import { IssueDetailView } from "@/features/issues/components/issue-detail-view";

export const instant = false;
export const metadata: Metadata = { title: "Issue" };

export default function IssueDetailPage() {
  return (
    <Suspense>
      <IssueDetailView />
    </Suspense>
  );
}
