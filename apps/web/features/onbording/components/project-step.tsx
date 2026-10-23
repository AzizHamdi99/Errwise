"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { createProjectSchema } from "@errwise/shared";
import type {
  CreateProjectInput,
  CreatedApiKey,
  PublicOrganization,
  PublicProject,
} from "@errwise/shared";
import { Field } from "@/components/shared/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api";
import { applyFieldErrors } from "@/lib/forms";
import { useCreateApiKey } from "@/features/api-keys/queries";
import { useCreateProject } from "@/features/projects/queries";
import { StepCard } from "./step-card";
import { PlatformPicker } from "@/features/projects/components/platform-picker";

// The schema has defaults, so the form's input type differs from its output type.
type ProjectForm = z.input<typeof createProjectSchema>;

interface Props {
  organization: PublicOrganization;
  project: PublicProject | null;
  onProjectCreated: (project: PublicProject) => void;
  onBack: () => void;
  onDone: (apiKey: CreatedApiKey) => void;
}

export function ProjectStep({
  organization,
  project,
  onProjectCreated,
  onBack,
  onDone,
}: Props) {
  const createProject = useCreateProject(organization.id);
  const createKey = useCreateApiKey(organization.id);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProjectForm, unknown, CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: project?.name ?? "", platform: "node" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSubmitting(true);
    try {
      let current = project;
      if (!current) {
        current = await createProject.mutateAsync(values);
        onProjectCreated(current);
      }
      onDone(await createKey.mutateAsync({ projectId: current.id }));
    } catch (error) {
      if (!applyFieldErrors(error, setError))
        setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <StepCard
      step={2}
      title="Create your first project"
      description="Choose the runtime you want to monitor first."
    >
      <form onSubmit={onSubmit} noValidate className="space-y-5">
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
            placeholder="Website"
            autoFocus
            readOnly={!!project}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "project-name-error" : undefined}
            {...register("name")}
          />
        </Field>

        <Controller
          control={control}
          name="platform"
          render={({ field }) => (
            <PlatformPicker
              value={field.value ?? "node"}
              onChange={field.onChange}
              disabled={!!project}
            />
          )}
        />

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            disabled={submitting}
          >
            <ArrowLeft aria-hidden />
            Back
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Creating…
              </>
            ) : (
              <>
                {project ? "Try again" : "Create project"}
                <ArrowRight aria-hidden />
              </>
            )}
          </Button>
        </div>
      </form>
    </StepCard>
  );
}
