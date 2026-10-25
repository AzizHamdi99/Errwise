import type { Metadata } from "next";
import { Suspense } from "react";
import { MembersView } from "@/features/members/components/members-view";

export const instant = false;
export const metadata: Metadata = { title: "Members" };

export default function MembersPage() {
  return (
    <Suspense>
      <MembersView />
    </Suspense>
  );
}
