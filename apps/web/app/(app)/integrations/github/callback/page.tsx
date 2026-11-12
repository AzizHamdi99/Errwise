import type { Metadata } from "next";
import { Suspense } from "react";
import { GithubCallbackView } from "@/features/github/components/github-callback-view";

export const instant = false;

export const metadata: Metadata = { title: "Connecting GitHub" };

export default function GithubCallbackPage() {
  return (
    <Suspense fallback={null}>
      <GithubCallbackView />
    </Suspense>
  );
}
