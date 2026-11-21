"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { updateProfileSchema } from "@errwise/shared";
import type { PublicUser, UpdateProfileInput } from "@errwise/shared";
import { Field } from "@/components/shared/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/api";
import { applyFieldErrors } from "@/lib/forms";
import { useUpdateProfile } from "../queries";

export function ProfileCard({ user }: { user: PublicUser }) {
  const update = useUpdateProfile();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user.name ?? "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    update.mutate(values, {
      onSuccess: (saved) => {
        reset({ name: saved.name ?? "" });
        toast.success("Profile saved");
      },
      onError: (error) => {
        if (!applyFieldErrors(error, setError))
          setFormError(getErrorMessage(error));
      },
    });
  });

  return (
    <section
      aria-labelledby="profile-title"
      className="rounded-xl border bg-card p-6"
    >
      <h2 id="profile-title" className="text-base font-medium">
        Profile
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your name is shown to the members of your organizations.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        {formError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}

        <Field label="Name" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "name-error" : undefined}
            {...register("name")}
          />
        </Field>

        <Field
          label="Email"
          htmlFor="email"
          hint="Used to sign in and for alerts. It can't be changed yet."
        >
          <Input id="email" value={user.email} readOnly />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty || update.isPending}>
            {update.isPending ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : null}
            Save
          </Button>
        </div>
      </form>
    </section>
  );
}
