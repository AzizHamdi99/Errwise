"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { PROJECT_PLATFORMS, updateProjectSchema } from "@errwise/shared";
import type { PublicProject, UpdateProjectInput } from "@errwise/shared";
import { Field } from "@/components/shared/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { getErrorMessage } from "@/lib/api";
import { applyFieldErrors } from "@/lib/forms";
import { PLATFORMS, toPlatform } from "../platforms";
import { useUpdateProject } from "../queries";

interface Props {
  orgId: string;
  project: PublicProject;
  canEdit: boolean;
}

const toFormValues = (project: PublicProject): UpdateProjectInput => ({
  name: project.name,
  platform: toPlatform(project.platform),
  retentionDays: project.retentionDays,
});

export function ProjectGeneralCard({ orgId, project, canEdit }: Props) {
  const update = useUpdateProject(orgId, project.id);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<UpdateProjectInput>({
    resolver: zodResolver(updateProjectSchema),
    defaultValues: toFormValues(project),
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    update.mutate(values, {
      onSuccess: (updated) => {
        reset(toFormValues(updated)); // the saved values are the new baseline
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
      aria-labelledby="project-general-title"
      className="rounded-xl border bg-card p-6"
    >
      <h2 id="project-general-title" className="text-base font-medium">
        General
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Project details and data retention.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        {formError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <Field
          label="Project name"
          htmlFor="project-name"
          error={errors.name?.message}
        >
          <Input
            id="project-name"
            readOnly={!canEdit}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "project-name-error" : undefined}
            {...register("name")}
          />
        </Field>

        <Field
          label="Platform"
          htmlFor="project-platform"
          error={errors.platform?.message}
        >
          <Controller
            control={control}
            name="platform"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={!canEdit}
              >
                <SelectTrigger id="project-platform" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {PLATFORMS[platform].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>

        <Controller
          control={control}
          name="retentionDays"
          render={({ field }) => (
            <Field
              label={`Retention · ${field.value ?? project.retentionDays} days`}
              htmlFor="project-retention"
              error={errors.retentionDays?.message}
              hint="Older events are deleted automatically to save storage."
            >
              <Slider
                id="project-retention"
                min={1}
                max={90}
                step={1}
                value={[field.value ?? project.retentionDays]}
                onValueChange={([value]) => field.onChange(value)}
                disabled={!canEdit}
              />
            </Field>
          )}
        />

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
            Only owners can edit project settings.
          </p>
        )}
      </form>
    </section>
  );
}
