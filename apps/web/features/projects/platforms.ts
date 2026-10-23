import { Layers, Server, Terminal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ProjectPlatform } from "@errwise/shared";

export const PLATFORMS: Record<
  ProjectPlatform,
  { label: string; icon: LucideIcon }
> = {
  node: { label: "Node", icon: Terminal },
  express: { label: "Express", icon: Server },
  nestjs: { label: "NestJS", icon: Layers },
};

/** The API stores the platform as a plain string, so fall back safely. */
export function getPlatform(value: string) {
  return Object.hasOwn(PLATFORMS, value)
    ? PLATFORMS[value as ProjectPlatform]
    : PLATFORMS.node;
}
