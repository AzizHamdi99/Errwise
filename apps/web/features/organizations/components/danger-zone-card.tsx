"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { PublicOrganization } from "@errwise/shared";
import { Button } from "@/components/ui/button";
import { DeleteOrganizationDialog } from "./delete-organization-dialog";

export function DangerZoneCard({ org }: { org: PublicOrganization }) {
  const [open, setOpen] = useState(false);

  return (
    <section
      aria-labelledby="danger-zone-title"
      className="rounded-xl border border-destructive/40 bg-card p-6"
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Danger zone
      </p>
      <h2
        id="danger-zone-title"
        className="mt-3 text-base font-medium text-destructive"
      >
        Delete organization
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Projects and API keys stop working. Apps will stop reporting errors.
      </p>
      <Button
        variant="outline"
        className="mt-4 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 aria-hidden />
        Delete organization
      </Button>

      <DeleteOrganizationDialog org={org} open={open} onOpenChange={setOpen} />
    </section>
  );
}
