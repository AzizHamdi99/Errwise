"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { createApiKeySchema } from "@errwise/shared";
import type { CreateApiKeyInput, CreatedApiKey } from "@errwise/shared";
import { Field } from "@/components/shared/field";
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
import { getErrorMessage } from "@/lib/api";
import { applyFieldErrors } from "@/lib/forms";
import { useCreateApiKey } from "../queries";

// The schema has a default, so the form's input type differs from its output type.
type KeyForm = z.input<typeof createApiKeySchema>;

interface Props {
  orgId: string;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: CreatedApiKey) => void;
}

export function CreateKeyDialog({ open, onOpenChange, ...formProps }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API key</DialogTitle>
          <DialogDescription>
            Choose a clear name so your team knows where this key is used.
          </DialogDescription>
        </DialogHeader>
        <CreateKeyForm {...formProps} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateKeyForm({
  orgId,
  projectId,
  onCreated,
  onClose,
}: Omit<Props, "open" | "onOpenChange"> & { onClose: () => void }) {
  const create = useCreateApiKey(orgId);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<KeyForm, unknown, CreateApiKeyInput>({
    resolver: zodResolver(createApiKeySchema),
    defaultValues: { name: "Default" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    create.mutate(
      { projectId, name: values.name },
      {
        onSuccess: onCreated,
        onError: (error) => {
          if (!applyFieldErrors(error, setError))
            setFormError(getErrorMessage(error));
        },
      },
    );
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Field label="Key name" htmlFor="key-name" error={errors.name?.message}>
        <Input
          id="key-name"
          autoFocus
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "key-name-error" : undefined}
          {...register("name")}
        />
      </Field>

      <p className="flex items-center gap-2 rounded-lg border bg-background/40 px-3 py-2.5 text-xs text-muted-foreground">
        <KeyRound className="size-3.5 shrink-0" aria-hidden />
        The full key is revealed once. You can revoke it at any time.
      </p>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Creating…
            </>
          ) : (
            "Create key"
          )}
        </Button>
      </div>
    </form>
  );
}
