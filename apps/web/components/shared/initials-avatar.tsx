import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  max?: number;
  className?: string;
}

export function InitialsAvatar({ label, max = 2, className }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-medium text-primary",
        className,
      )}
    >
      {getInitials(label, max)}
    </span>
  );
}
