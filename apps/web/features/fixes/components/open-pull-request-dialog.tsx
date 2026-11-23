"use client";

import { GitPullRequestDraft, Loader2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repo: string;
  branch: string;
  files: string[];
  isPending: boolean;
  error: string | null;
  onConfirm: () => void;
}

/**
 * Opening the pull request pushes a branch, so the repository's CI and preview deployments run
 * code that an AI wrote. This is the last stop: it says so, and asks for a deliberate
 * "I have read the change" before the button works.
 */
export function OpenPullRequestDialog({
  open,
  onOpenChange,
  repo,
  branch,
  files,
  isPending,
  error,
  onConfirm,
}: Props) {
  const [read, setRead] = useState(false);

  function change(next: boolean) {
    if (isPending) return;
    if (!next) setRead(false);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open a draft pull request?</DialogTitle>
          <DialogDescription>
            Errwise will push the branch <code>{branch}</code> to{" "}
            <strong>{repo}</strong> and open a draft pull request with the
            change. It never merges anything.
          </DialogDescription>
        </DialogHeader>

        <div
          role="note"
          className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Your CI and any preview deployments will run on this branch, maybe
            with your repository&apos;s secrets, before anyone merges it. The AI
            wrote it from error text that anyone with an API key of this project
            can influence.
          </p>
        </div>

        {files.length > 0 ? (
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">
              {files.length === 1 ? "File changed" : "Files changed"}
            </p>
            <ul className="space-y-0.5 rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs">
              {files.map((file) => (
                <li key={file} className="break-all">
                  {file}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <Checkbox
            id="fix-read"
            checked={read}
            disabled={isPending}
            onCheckedChange={(checked) => setRead(checked === true)}
          />
          <Label htmlFor="fix-read">I have read the change above</Label>
        </div>

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => change(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!read || isPending}>
            {isPending ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Opening…
              </>
            ) : (
              <>
                <GitPullRequestDraft aria-hidden />
                Open draft pull request
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
