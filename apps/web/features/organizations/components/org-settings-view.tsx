"use client";

import { can } from "@/lib/permissions";
import { useCurrentOrg } from "../use-current-org";
import { DangerZoneCard } from "./danger-zone-card";
import { GeneralSettingsCard } from "./general-settings-card";

export function OrgSettingsView() {
  const { org } = useCurrentOrg();
  if (!org) return null; // OrgGate guarantees this never happens

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {org.name} / Workspace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Organization settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Update workspace details and organization-wide access.
        </p>
      </header>

      <div className="max-w-2xl space-y-6">
        {/* key: switching organization remounts the form with fresh values */}
        <GeneralSettingsCard key={org.id} org={org} />
        {can(org.role, "org.delete") ? <DangerZoneCard org={org} /> : null}
      </div>
    </div>
  );
}
