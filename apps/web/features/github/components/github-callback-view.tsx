"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { getErrorMessage } from "@/lib/api";
import { useCompleteGithubInstallation } from "../use-github";

export function GithubCallbackView() {
  const router = useRouter();
  const params = useSearchParams();
  const { mutate, data, isError, error } = useCompleteGithubInstallation();
  const started = useRef(false);

  const installationId = params.get("installation_id");
  const code = params.get("code");
  const state = params.get("state");
  const isValidLink = Boolean(installationId && code && state);

  useEffect(() => {
    // The OAuth code is single use: React Strict Mode must not send it twice.
    if (!installationId || !code || !state || started.current) return;
    started.current = true;
    mutate({ installationId, code, state });
  }, [installationId, code, state, mutate]);

  useEffect(() => {
    if (data) {
      router.replace(
        `/organizations/${data.organizationId}/projects/${data.projectId}/integrations`,
      );
    }
  }, [data, router]);

  const failure = !isValidLink
    ? "This GitHub link is invalid or incomplete."
    : isError
      ? getErrorMessage(error)
      : null;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm">
      {failure ? (
        <>
          <p className="text-destructive">{failure}</p>
          <Link href="/organizations" className="underline underline-offset-4">
            Back to Errwise
          </Link>
        </>
      ) : (
        <p className="text-muted-foreground">Connecting GitHub…</p>
      )}
    </div>
  );
}
