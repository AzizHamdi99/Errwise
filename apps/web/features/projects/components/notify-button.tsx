"use client";

import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  on: boolean;
  pending: boolean;
  onToggle: () => void;
}

/** The button only: where the state comes from is up to the caller. */
export function NotifyButton({ on, pending, onToggle }: Props) {
  return (
    <Button
      variant={on ? "secondary" : "outline"}
      size="sm"
      aria-pressed={on}
      disabled={pending}
      onClick={onToggle}
      title={
        on
          ? "You get an email for each new issue. Click to turn off."
          : "Get an email when a new issue appears in this project."
      }
    >
      {on ? (
        <Bell aria-hidden className="text-primary" />
      ) : (
        <BellOff aria-hidden />
      )}
      {on ? "Notifications on" : "Notify me"}
    </Button>
  );
}
