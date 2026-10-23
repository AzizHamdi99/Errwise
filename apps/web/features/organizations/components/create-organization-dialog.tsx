"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createOrganizationSchema } from "@errwise/shared";
import type { CreateOrganizationInput } from "@errwise/shared";
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
import { setLastOrgId } from "@/lib/last-org";
import { useCreateOrganization } from "../queries";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrganizationDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>
            A shared workspace for your team&apos;s projects and issues.
          </DialogDescription>
        </DialogHeader>
        <CreateOrganizationForm onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateOrganizationForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const create = useCreateOrganization();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateOrganizationInput>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    create.mutate(values, {
      onSuccess: (org) => {
        setLastOrgId(org.id);
        toast.success("Organization created");
        onClose();
        router.push(`/organizations/${org.id}/projects`);
      },
      onError: (error) => {
        if (!applyFieldErrors(error, setError))
          setFormError(getErrorMessage(error));
      },
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Field
        label="Organization name"
        htmlFor="new-org-name"
        error={errors.name?.message}
      >
        <Input
          id="new-org-name"
          placeholder="Acme"
          autoFocus
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "new-org-name-error" : undefined}
          {...register("name")}
        />
      </Field>

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
            "Create organization"
          )}
        </Button>
      </div>
    </form>
  );
}
