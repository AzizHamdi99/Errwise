import Image from "next/image";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/logo.png"
        alt="Errwise logo"
        width={32}
        height={32}
        priority
        className="size-8 rounded-lg object-contain"
      />

      <span className="text-sm font-medium tracking-tight">Errwise</span>
    </div>
  );
}
