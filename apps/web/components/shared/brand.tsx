// import { Activity } from "lucide-react";
// import { cn } from "@/lib/utils";

// export function Brand({ className }: { className?: string }) {
//   return (
//     <div className={cn("flex items-center gap-2.5", className)}>
//       <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-[#b06cff] text-primary-foreground shadow-[0_0_20px_-4px_var(--primary)]">
//         <Activity className="size-4" aria-hidden />
//       </span>
//       <span className="text-sm font-medium tracking-tight">Errwise</span>
//     </div>
//   );
// }

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
