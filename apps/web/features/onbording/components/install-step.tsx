"use client";

import { Lock } from "lucide-react";
import { PROJECT_PLATFORMS } from "@errwise/shared";
import type {
  CreatedApiKey,
  PublicOrganization,
  PublicProject,
} from "@errwise/shared";
import { CodeBlock } from "@/components/shared/code-block";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHasIssues } from "@/features/issues/queries";
import { FirstErrorStatus } from "./first-error-status";
import { StepCard } from "./step-card";
import { getPlatform, toPlatform } from "@/features/projects/platforms";
import { getSnippet } from "@/features/projects/snippets";

interface Props {
  organization: PublicOrganization;
  project: PublicProject;
  apiKey: CreatedApiKey;
  onFinish: () => void;
}

export function InstallStep({
  organization,
  project,
  apiKey,
  onFinish,
}: Props) {
  const { data: received = false } = useHasIssues(organization.id, project.id);
  const initialTab = toPlatform(project.platform);
  return (
    <StepCard
      step={3}
      title="Install the SDK"
      description="Copy your key, add the package and initialize Errwise in your service."
    >
      <div className="space-y-6">
        <div
          role="note"
          className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400"
        >
          <Lock className="size-4 shrink-0" aria-hidden />
          This project key is shown only in this setup step. Save it somewhere
          secure.
        </div>

        <div className="flex items-stretch gap-3">
          <code className="flex min-w-0 flex-1 items-center overflow-x-auto rounded-lg border bg-background/60 px-4 py-3 font-mono text-sm">
            {apiKey.key}
          </code>
          <CopyButton value={apiKey.key} label="Copy key" className="h-auto" />
        </div>

        <Tabs defaultValue={initialTab}>
          <TabsList className="h-auto w-full justify-start gap-5 rounded-none border-b bg-transparent p-0">
            {PROJECT_PLATFORMS.map((platform) => (
              <TabsTrigger
                key={platform}
                value={platform}
                className="flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-2 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                {getPlatform(platform).label}
              </TabsTrigger>
            ))}
          </TabsList>
          {PROJECT_PLATFORMS.map((platform) => (
            <TabsContent key={platform} value={platform} className="mt-4">
              <CodeBlock code={getSnippet(platform, apiKey.key)} />
            </TabsContent>
          ))}
        </Tabs>

        <FirstErrorStatus received={received} />

        <div className="flex justify-end">
          {received ? (
            <Button onClick={onFinish}>Open dashboard</Button>
          ) : (
            <Button variant="ghost" onClick={onFinish}>
              Skip for now
            </Button>
          )}
        </div>
      </div>
    </StepCard>
  );
}
