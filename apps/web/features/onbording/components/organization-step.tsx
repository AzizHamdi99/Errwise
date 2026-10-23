"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createOrganizationSchema } from "@errwise/shared";
import type {
  CreateOrganizationInput,
  PublicOrganization,
} from "@errwise/shared";
import { Field } from "@/components/shared/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api";
import { applyFieldErrors } from "@/lib/forms";
import { useCreateOrganization } from "@/features/organizations/queries";
import { StepCard } from "./step-card";

interface Props {
  organization: PublicOrganization | null;
  onDone: (organization: PublicOrganization) => void;
}

export function OrganizationStep({ organization, onDone }: Props) {
  const create = useCreateOrganization();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CreateOrganizationInput>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: { name: organization?.name ?? "" },
  });

  const onSubmit = handleSubmit((values) => {
    if (organization) return onDone(organization);

    setFormError(null);
    create.mutate(values, {
      onSuccess: onDone,
      onError: (error) => {
        if (!applyFieldErrors(error, setError))
          setFormError(getErrorMessage(error));
      },
    });
  });

  return (
    <StepCard
      step={1}
      title="Create your organization"
      description="A shared workspace for your team's projects and issues."
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
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
            placeholder="Acme"
            autoComplete="organization"
            autoFocus
            readOnly={!!organization}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "org-name-error" : undefined}
            {...register("name")}
          />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Creating…
              </>
            ) : (
              <>
                Continue
                <ArrowRight aria-hidden />
              </>
            )}
          </Button>
        </div>
      </form>
    </StepCard>
  );
}
