import { formatRelative } from "@/lib/format";

interface Props {
  iso: string;
  style?: "long" | "narrow";
  className?: string;
}

export function RelativeTime({ iso, style, className }: Props) {
  return (
    <time
      dateTime={iso}
      title={new Date(iso).toLocaleString()}
      className={className}
    >
      {formatRelative(iso, style)}
    </time>
  );
}
