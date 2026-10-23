"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  CreatedApiKey,
  PublicOrganization,
  PublicProject,
} from "@errwise/shared";
import { Brand } from "@/components/shared/brand";
import { InstallStep } from "./install-step";
import { OrganizationStep } from "./organization-step";
import { ProjectStep } from "./project-step";
import { Stepper } from "./stepper";

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [organization, setOrganization] = useState<PublicOrganization | null>(
    null,
  );
  const [project, setProject] = useState<PublicProject | null>(null);
  const [apiKey, setApiKey] = useState<CreatedApiKey | null>(null);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-8">
      <header className="flex items-center justify-between">
        <Brand />
        <Link
          href="/organizations"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip onboarding
        </Link>
      </header>

      <Stepper current={step} />

      {step === 1 && (
        <OrganizationStep
          organization={organization}
          onDone={(created) => {
            setOrganization(created);
            setStep(2);
          }}
        />
      )}

      {step === 2 && organization && (
        <ProjectStep
          organization={organization}
          project={project}
          onProjectCreated={setProject}
          onBack={() => setStep(1)}
          onDone={(key) => {
            setApiKey(key);
            setStep(3);
          }}
        />
      )}

      {step === 3 && organization && project && apiKey && (
        <InstallStep
          organization={organization}
          project={project}
          apiKey={apiKey}
          onFinish={() =>
            router.push(`/organizations/${organization.id}/projects`)
          }
        />
      )}
    </div>
  );
}
