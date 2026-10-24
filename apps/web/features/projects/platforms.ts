import { Layers, Server, Terminal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PROJECT_PLATFORMS } from "@errwise/shared";
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
export const toPlatform = (value: string): ProjectPlatform =>
  PROJECT_PLATFORMS.find((platform) => platform === value) ?? "node";

export const getPlatform = (value: string) => PLATFORMS[toPlatform(value)];
