import { OrgGate } from "@/features/organizations/components/org-gate";

export const instant = false;

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  return <OrgGate>{children}</OrgGate>;
}
