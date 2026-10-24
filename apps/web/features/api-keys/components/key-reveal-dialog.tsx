"use client";

import { Lock } from "lucide-react";
import { useState } from "react";
import type { CreatedApiKey } from "@errwise/shared";
import { CodeBlock } from "@/components/shared/code-block";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toPlatform } from "@/features/projects/platforms";
import { getSnippet } from "@/features/projects/snippets";

interface Props {
  apiKey: CreatedApiKey | null;
  platform: string;
  onClose: () => void;
}

export function KeyRevealDialog({ apiKey, platform, onClose }: Props) {
  return (
    <Dialog open={!!apiKey}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Your new API key</DialogTitle>
          <DialogDescription>
            Add it to your service to start sending errors.
          </DialogDescription>
        </DialogHeader>
        {/* the body unmounts on close, so the checkbox resets for the next key */}
        {apiKey ? (
          <RevealBody apiKey={apiKey} platform={platform} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function RevealBody({
  apiKey,
  platform,
  onClose,
}: {
  apiKey: CreatedApiKey;
  platform: string;
  onClose: () => void;
}) {
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-5">
      <div
        role="note"
        className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-600 dark:text-amber-400"
      >
        <Lock className="size-4 shrink-0" aria-hidden />
        Copy this key now. You won&apos;t be able to see it again.
      </div>

      <div className="flex items-stretch gap-3">
        <code className="flex min-w-0 flex-1 items-center overflow-x-auto rounded-lg border bg-background/60 px-4 py-3 font-mono text-sm">
          {apiKey.key}
        </code>
        <CopyButton value={apiKey.key} label="Copy key" className="h-auto" />
      </div>

      <CodeBlock code={getSnippet(toPlatform(platform), apiKey.key)} />

      <div className="flex items-center gap-2">
        <Checkbox
          id="key-saved"
          checked={saved}
          onCheckedChange={(checked) => setSaved(checked === true)}
        />
        <Label htmlFor="key-saved">I have saved this key</Label>
      </div>

      <div className="flex justify-end">
        <Button onClick={onClose} disabled={!saved}>
          Done
        </Button>
      </div>
    </div>
  );
}
