"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { createInvitationSchema } from "@errwise/shared";
import type { CreateInvitationInput } from "@errwise/shared";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { applyFieldErrors } from "@/lib/forms";
import { ROLE_LABELS } from "@/lib/permissions";
import type { InvitableRole } from "@/lib/permissions";
import { invitationErrorMessage } from "../errors";
import { useInvite } from "../queries";

// The schema has a default role, so the form's input type differs from its output type.
type InviteForm = z.input<typeof createInvitationSchema>;

interface Props {
  orgId: string;
  orgName: string;
  roles: InvitableRole[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: () => void;
}

export function InviteDialog({
  orgName,
  open,
  onOpenChange,
  ...formProps
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription>
            They&apos;ll receive a link to join {orgName}.
          </DialogDescription>
        </DialogHeader>
        <InviteForm {...formProps} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function InviteForm({
  orgId,
  roles,
  onInvited,
  onClose,
}: Pick<Props, "orgId" | "roles" | "onInvited"> & { onClose: () => void }) {
  const invite = useInvite(orgId);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<InviteForm, unknown, CreateInvitationInput>({
    resolver: zodResolver(createInvitationSchema),
    defaultValues: { email: "", role: "member" },
  });

  const roleItems = roles.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
  }));

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    invite.mutate(values, {
      onSuccess: (invitation) => {
        toast.success(`Invitation sent to ${invitation.email}`);
        onClose();
        onInvited();
      },
      onError: (error) => {
        if (applyFieldErrors(error, setError)) return;
        if (error instanceof ApiError && error.status === 409) {
          setError("email", { message: "This person is already a member." });
          return;
        }
        setFormError(invitationErrorMessage(error));
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
        label="Email address"
        htmlFor="invite-email"
        error={errors.email?.message}
      >
        <Input
          id="invite-email"
          type="email"
          placeholder="name@company.com"
          autoComplete="off"
          autoFocus
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? "invite-email-error" : undefined}
          {...register("email")}
        />
      </Field>

      <Controller
        control={control}
        name="role"
        render={({ field }) => (
          <Field
            label="Role"
            htmlFor="invite-role"
            error={errors.role?.message}
            hint={
              roles.length > 1
                ? "Choose Admin or Member."
                : "Admins can only invite members."
            }
          >
            <Select
              items={roleItems}
              value={field.value ?? "member"}
              onValueChange={(value) => value && field.onChange(value)}
              disabled={roles.length < 2}
            >
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={invite.isPending}>
          {invite.isPending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Sending…
            </>
          ) : (
            "Send invitation"
          )}
        </Button>
      </div>
    </form>
  );
}
