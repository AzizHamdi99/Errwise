import Link from "next/link";
import { Button } from "@/components/ui/button";

const CTA =
  "h-11 px-6 text-base hover:-translate-y-0.5 motion-reduce:hover:translate-y-0";

export function CtaButtons() {
  return (
    <div className="flex flex-col justify-center gap-3 sm:flex-row">
      <Button
        className={CTA}
        render={<Link href="/register" />}
        nativeButton={false}
      >
        Get started free
      </Button>
      <Button
        variant="outline"
        className={CTA}
        render={<Link href="/docs" />}
        nativeButton={false}
      >
        View docs
      </Button>
    </div>
  );
}
