import type { Metadata } from "next";
import { UsageView } from "@/features/stats/components/usage-view";

export const metadata: Metadata = { title: "Usage" };

export default function UsagePage() {
  return <UsageView />;
}
