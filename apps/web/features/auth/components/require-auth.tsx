"use client";

import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ApiError, getErrorMessage } from "@/lib/api";
import { useMe } from "../queries";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: user, error, refetch } = useMe();
  // the api client already tried a silent refresh, so a 401 here means: log in again
  const unauthorized = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    if (unauthorized)
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [unauthorized, router, pathname]);

  if (error && !unauthorized) {
    return (
      <div className="grid min-h-svh place-items-center p-6 text-center">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {getErrorMessage(error)}
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="grid min-h-svh place-items-center">
        <Loader2
          className="size-5 animate-spin text-muted-foreground"
          aria-label="Loading"
        />
      </div>
    );
  }

  return <>{children}</>;
}
