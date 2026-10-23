import { Activity, ArrowRight, CalendarDays, Settings } from "lucide-react";
import Link from "next/link";
import type { PublicProject } from "@errwise/shared";
import { formatDate } from "@/lib/format";
import { getPlatform } from "../platforms";

interface Props {
  project: PublicProject;
  canEdit: boolean;
}

export function ProjectCard({ project, canEdit }: Props) {
  const { label, icon: PlatformIcon } = getPlatform(project.platform);
  const base = `/organizations/${project.organizationId}/projects/${project.id}`;

  return (
    <article className="group relative rounded-xl border bg-card p-5 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <PlatformIcon className="size-4" aria-hidden />
        </span>
        <div className="relative z-10 flex items-center gap-1 text-muted-foreground">
          {canEdit ? (
            <Link
              href={`${base}/settings`}
              aria-label={`${project.name} settings`}
              className="rounded-md p-1.5 outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Settings className="size-4" aria-hidden />
            </Link>
          ) : null}
          <ArrowRight
            aria-hidden
            className="size-4 transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </div>

      <h3 className="mt-4 text-base font-medium">
        <Link
          href={`${base}/issues`}
          className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring"
        >
          {project.name}
        </Link>
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>

      <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
        <li className="flex items-center gap-2">
          <CalendarDays className="size-3.5" aria-hidden />
          Created {formatDate(project.createdAt)}
        </li>
        <li className="flex items-center gap-2">
          <Activity className="size-3.5" aria-hidden />
          Retention {project.retentionDays} days
        </li>
      </ul>
    </article>
  );
}
