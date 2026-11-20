import { Info, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SourceBanner } from "../source-view";

interface Props {
  banner: SourceBanner;
  onRetry: () => void;
}

export function SourceBannerView({ banner, onRetry }: Props) {
  const Icon = banner.tone === "warning" ? TriangleAlert : Info;
  const { action } = banner;

  return (
    <div
      role="status"
      className={cn(
        "mx-4 mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border px-3 py-2 text-xs",
        banner.tone === "warning"
          ? "border-amber-500/40 bg-amber-500/10"
          : "bg-muted/40",
      )}
    >
      <p className="flex min-w-0 flex-1 items-start gap-2">
        <Icon
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
        <span>{banner.text}</span>
      </p>

      {action?.kind === "retry" ? (
        <Button variant="outline" size="xs" onClick={onRetry}>
          {action.label}
        </Button>
      ) : null}
      {action?.kind === "link" ? (
        <Button
          variant="outline"
          size="xs"
          render={
            action.external ? (
              <a href={action.href} target="_blank" rel="noopener noreferrer" />
            ) : (
              <Link href={action.href} />
            )
          }
        >
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
