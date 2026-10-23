"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { updateOrganizationSchema } from "@errwise/shared";
import type {
  PublicOrganization,
  UpdateOrganizationInput,
} from "@errwise/shared";
import { Field } from "@/components/shared/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api";
import { applyFieldErrors } from "@/lib/forms";
import { can } from "@/lib/permissions";
import { useUpdateOrganization } from "../queries";

export function GeneralSettingsCard({ org }: { org: PublicOrganization }) {
  const update = useUpdateOrganization(org.id);
  const canEdit = can(org.role, "org.rename");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<UpdateOrganizationInput>({
    resolver: zodResolver(updateOrganizationSchema),
    defaultValues: { name: org.name },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    update.mutate(values, {
      onSuccess: (updated) => {
        reset({ name: updated.name }); // the saved value is the new baseline
        toast.success("Changes saved");
      },
      onError: (error) => {
        if (!applyFieldErrors(error, setError))
          setFormError(getErrorMessage(error));
      },
    });
  });

  return (
    <section
      aria-labelledby="general-title"
      className="rounded-xl border bg-card p-6"
    >
      <h2 id="general-title" className="text-base font-medium">
        General
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Visible to everyone in the organization.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        {formError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <Field
          label="Organization name"
          htmlFor="org-name"
          error={errors.name?.message}
        >
          <Input
            id="org-name"
            autoComplete="organization"
            readOnly={!canEdit}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "org-name-error" : undefined}
            {...register("name")}
          />
        </Field>

        <Field
          label="Organization slug"
          htmlFor="org-slug"
          hint="Generated from the name when the organization is created. It can't be changed."
        >
          <Input
            id="org-slug"
            value={org.slug}
            readOnly
            aria-describedby="org-slug-hint"
            className="font-mono"
          />
        </Field>

        {canEdit ? (
          <Button type="submit" disabled={!isDirty || update.isPending}>
            {update.isPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only owners and admins can edit these settings.
          </p>
        )}
      </form>
    </section>
  );
}
