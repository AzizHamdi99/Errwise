"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { createProjectSchema } from "@errwise/shared";
import type { CreateProjectInput } from "@errwise/shared";
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
import { useCreateProject } from "../queries";
import { PlatformPicker } from "./platform-picker";

// The schema has defaults, so the form's input type differs from its output type.
type ProjectForm = z.input<typeof createProjectSchema>;

interface Props {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ orgId, open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Each project has its own API keys and issues.
          </DialogDescription>
        </DialogHeader>
        <CreateProjectForm orgId={orgId} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function CreateProjectForm({
  orgId,
  onClose,
}: {
  orgId: string;
  onClose: () => void;
}) {
  const create = useCreateProject(orgId);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ProjectForm, unknown, CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", platform: "node" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    create.mutate(values, {
      onSuccess: () => {
        toast.success("Project created");
        onClose();
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
        label="Project name"
        htmlFor="new-project-name"
        error={errors.name?.message}
      >
        <Input
          id="new-project-name"
          placeholder="Website"
          autoFocus
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "new-project-name-error" : undefined}
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
          />
        )}
      />

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
            "Create project"
          )}
        </Button>
      </div>
    </form>
  );
}
