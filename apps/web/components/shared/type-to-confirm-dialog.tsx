"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  consequences?: string[];
  /** The exact text the user must type. */
  confirmText: string;
  actionLabel: string;
  pendingLabel: string;
  isPending: boolean;
  error?: string | null;
  onConfirm: () => void;
}

export function TypeToConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  ...body
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ConfirmBody {...body} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

type BodyProps = Omit<
  Props,
  "open" | "onOpenChange" | "title" | "description"
> & {
  onCancel: () => void;
};

function ConfirmBody({
  consequences,
  confirmText,
  actionLabel,
  pendingLabel,
  isPending,
  error,
  onConfirm,
  onCancel,
}: BodyProps) {
  const [value, setValue] = useState("");
  const matches = value === confirmText;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (matches && !isPending) onConfirm();
      }}
      className="space-y-5"
    >
      {consequences?.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {consequences.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="confirm-input">
          Type <span className="font-mono text-foreground">{confirmText}</span>{" "}
          to confirm
        </Label>
        <Input
          id="confirm-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
          autoFocus
          disabled={isPending}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="destructive"
          disabled={!matches || isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              {pendingLabel}
            </>
          ) : (
            actionLabel
          )}
        </Button>
      </div>
    </form>
  );
}
