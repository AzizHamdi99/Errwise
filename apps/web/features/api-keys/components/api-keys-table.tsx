"use client";

import { Check, X } from "lucide-react";
import type { PublicApiKey } from "@errwise/shared";
import { RelativeTime } from "@/components/shared/relative-time";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function StatusBadge({ revoked }: { revoked: boolean }) {
  return revoked ? (
    <span className="inline-flex items-center gap-1 rounded-md border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      <X className="size-3" aria-hidden />
      Revoked
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-500">
      <Check className="size-3" aria-hidden />
      Active
    </span>
  );
}

interface Props {
  keys: PublicApiKey[];
  canWrite: boolean;
  onRevoke: (key: PublicApiKey) => void;
}

export function ApiKeysTable({ keys, canWrite, onRevoke }: Props) {
  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Key prefix</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last used</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-24">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => {
            const revoked = !!key.revokedAt;
            return (
              <TableRow key={key.id}>
                <TableCell className="font-medium">{key.name}</TableCell>
                <TableCell
                  className={cn(
                    "font-mono text-xs",
                    revoked && "text-muted-foreground line-through",
                  )}
                >
                  {key.prefix}…
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(key.createdAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {key.lastUsedAt ? (
                    <RelativeTime iso={key.lastUsedAt} />
                  ) : (
                    "Never"
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge revoked={revoked} />
                </TableCell>
                <TableCell className="text-right">
                  {canWrite && !revoked ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Revoke ${key.name}`}
                      onClick={() => onRevoke(key)}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
