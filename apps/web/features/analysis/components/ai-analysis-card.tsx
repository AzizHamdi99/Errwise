"use client";

import { Loader2, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import type { PublicIssueAnalysis } from "@errwise/shared";
import { CopyButton } from "@/components/shared/copy-button";
import { Eyebrow } from "@/components/shared/eyebrow";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getErrorMessage } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CONFIDENCE } from "../confidence";
import { useAnalyzeIssue, useIssueAnalysis } from "../queries";

/**
 * The API's messages for these statuses are written for people ("AI is busy right
 * now..."), but getErrorMessage hides every 5xx, so allow the AI ones through.
 */
const FRIENDLY_STATUSES = new Set([429, 502, 503, 504]);

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && FRIENDLY_STATUSES.has(error.status)) {
    return error.message;
  }
  return getErrorMessage(error);
}

function asText(analysis: PublicIssueAnalysis): string {
  return [
    analysis.summary,
    `Probable cause: ${analysis.probableCause}`,
    `Suggested fix: ${analysis.suggestedFix}`,
  ].join("\n\n");
}

function Shell({
  actions,
  children,
}: {
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label="AI analysis"
      className="overflow-hidden rounded-xl border border-primary/25 bg-card"
    >
      <header className="flex items-center justify-between gap-2 border-b border-primary/15 bg-primary/5 px-4 py-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-primary" aria-hidden />
          AI analysis
        </h2>
        {actions ? (
          <div className="flex items-center gap-2">{actions}</div>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function Privacy({ includesCode }: { includesCode: boolean }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        Secrets and personal data are removed before anything is sent.
        {includesCode
          ? " The code around the failing lines is included, because source code is turned on for this project."
          : ""}
      </span>
    </p>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="space-y-4 px-4 py-5" aria-busy="true">
      <p
        role="status"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin text-primary" aria-hidden />
        {label}
      </p>
      <div className="space-y-2">
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

function Result({ analysis }: { analysis: PublicIssueAnalysis }) {
  const confidence = CONFIDENCE[analysis.confidence];

  return (
    <Shell
      actions={
        <>
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-medium",
              confidence.style,
            )}
            title="How sure the model is, based on the evidence it was given"
          >
            {confidence.label}
          </span>
          <CopyButton value={asText(analysis)} label="Copy" size="sm" />
        </>
      }
    >
      <div className="space-y-5 px-4 py-4">
        {/* Model output is rendered as plain text, never as HTML or markdown. */}
        <p className="text-sm leading-6 font-medium whitespace-pre-line">
          {analysis.summary}
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Eyebrow>Probable cause</Eyebrow>
            <p className="text-sm leading-6 whitespace-pre-line">
              {analysis.probableCause}
            </p>
          </div>
          <div className="space-y-1.5">
            <Eyebrow>Suggested fix</Eyebrow>
            <p className="text-sm leading-6 whitespace-pre-line">
              {analysis.suggestedFix}
            </p>
          </div>
        </div>

        {analysis.reproSteps && analysis.reproSteps.length > 0 ? (
          <div className="space-y-1.5">
            <Eyebrow>Likely steps to reproduce (a guess)</Eyebrow>
            <ol className="list-decimal space-y-1 pl-5 text-sm leading-6">
              {analysis.reproSteps.map((step, index) => (
                <li key={index} className="whitespace-pre-line">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {analysis.issueTitle ? (
          <div className="space-y-1.5">
            <Eyebrow>Title for a GitHub issue</Eyebrow>
            <p className="text-sm leading-6">{analysis.issueTitle}</p>
          </div>
        ) : null}

        {analysis.framesUsed.length > 0 ? (
          <div className="space-y-1.5">
            <Eyebrow>Based on</Eyebrow>
            <ul className="space-y-0.5 rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs">
              {analysis.framesUsed.map((frame) => (
                <li key={frame} className="break-all text-muted-foreground">
                  {frame}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {analysis.sourceFiles.length > 0 ? (
          <div className="space-y-1.5">
            <Eyebrow>Code it read</Eyebrow>
            <ul className="space-y-0.5 rounded-lg bg-muted/60 px-3 py-2 font-mono text-xs">
              {analysis.sourceFiles.map((file) => (
                <li key={file} className="break-all text-muted-foreground">
                  {file}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-2 text-xs text-muted-foreground">
        <span>
          AI-generated and can be wrong. Check it before you act on it.
        </span>
        <span title={new Date(analysis.createdAt).toLocaleString()}>
          {analysis.model} · {formatRelative(analysis.createdAt)}
        </span>
      </footer>
    </Shell>
  );
}

interface Props {
  orgId: string;
  projectId: string;
  issueId: string;
  /** The project's source code switch: when on, the analysis also reads the code. */
  includesCode: boolean;
}

export function AiAnalysisCard({
  orgId,
  projectId,
  issueId,
  includesCode,
}: Props) {
  const query = useIssueAnalysis(orgId, projectId, issueId);
  const analyze = useAnalyzeIssue(orgId, projectId, issueId);

  if (query.isPending) {
    return (
      <Shell>
        <Loading label="Checking for an analysis…" />
      </Shell>
    );
  }

  if (analyze.isPending) {
    return (
      <Shell>
        <Loading label="Analyzing the stack trace…" />
      </Shell>
    );
  }

  const analysis = query.data;
  if (analysis) return <Result analysis={analysis} />;

  // Either the first load failed, or asking for an analysis failed.
  const failure = analyze.isError
    ? analyze.error
    : query.isError
      ? query.error
      : null;

  if (failure) {
    return (
      <Shell>
        <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-5">
          <div className="flex min-w-0 items-start gap-3">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-destructive"
              aria-hidden
            />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                The analysis didn&apos;t work
              </p>
              <p role="alert" className="text-sm text-muted-foreground">
                {errorMessage(failure)}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              analyze.isError ? analyze.mutate() : query.refetch()
            }
          >
            Try again
          </Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-sm font-medium">Understand this error faster</p>
          <p className="max-w-prose text-sm text-muted-foreground">
            Get a plain-language summary, the probable cause and a suggested
            fix, based on the latest event of this issue.
          </p>
          <Privacy includesCode={includesCode} />
        </div>
        <Button size="sm" onClick={() => analyze.mutate()}>
          <Sparkles aria-hidden />
          Explain this issue
        </Button>
      </div>
    </Shell>
  );
}
