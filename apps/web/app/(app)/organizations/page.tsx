import type { Metadata } from "next";
import { OrganizationsIndex } from "@/features/organizations/components/organizations-index";

export const metadata: Metadata = { title: "Organizations" };

export default function OrganizationsPage() {
  return <OrganizationsIndex />;
}
