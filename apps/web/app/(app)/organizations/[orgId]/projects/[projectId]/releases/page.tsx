import type { Metadata } from "next";
import { Suspense } from "react";
import { ReleasesView } from "@/features/stats/components/releases-view";

export const instant = false;
export const metadata: Metadata = { title: "Releases" };

export default function ReleasesPage() {
  return (
    <Suspense>
      <ReleasesView />
    </Suspense>
  );
}
