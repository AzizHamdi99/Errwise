import type { Metadata } from "next";
import { AuditLogView } from "@/features/audit/components/audit-log-view";

export const metadata: Metadata = { title: "Audit log" };

export default function AuditLogPage() {
  return <AuditLogView />;
}
