"use client";

import { LogOut } from "lucide-react";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { Button } from "@/components/ui/button";
import { useLogout, useMe } from "../queries";

export function UserMenu() {
  const { data: user } = useMe();
  const logout = useLogout();
  if (!user) return null;

  const display = user.name ?? user.email;

  return (
    <div className="flex items-center gap-3 border-t pt-4">
      <InitialsAvatar label={display} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{display}</p>
        {user.name ? (
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        ) : null}
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Log out"
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
      >
        <LogOut aria-hidden />
      </Button>
    </div>
  );
}
