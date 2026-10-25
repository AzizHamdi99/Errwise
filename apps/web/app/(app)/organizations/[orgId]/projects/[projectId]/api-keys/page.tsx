import type { Metadata } from "next";
import { ApiKeysView } from "@/features/api-keys/components/api-keys-view";
export const instant = false;

export const metadata: Metadata = { title: "API keys" };

export default function ApiKeysPage() {
  return <ApiKeysView />;
}
