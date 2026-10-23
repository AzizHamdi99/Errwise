import type { Metadata } from "next";
import { OrgSettingsView } from "@/features/organizations/components/org-settings-view";

export const metadata: Metadata = { title: "Organization settings" };

export default function OrgSettingsPage() {
  return <OrgSettingsView />;
}
