import { PROJECT_PLATFORMS } from "@errwise/shared";
import type { ProjectPlatform } from "@errwise/shared";
import { PLATFORMS } from "../platforms";

interface Props {
  value: ProjectPlatform;
  onChange: (value: ProjectPlatform) => void;
  disabled?: boolean;
}

export function PlatformPicker({ value, onChange, disabled }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Platform"
      className="grid grid-cols-3 gap-3"
    >
      {PROJECT_PLATFORMS.map((option) => {
        const { label, icon: Icon } = PLATFORMS[option];
        return (
          <label
            key={option}
            className="relative cursor-pointer has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <input
              type="radio"
              name="platform"
              value={option}
              checked={value === option}
              disabled={disabled}
              onChange={() => onChange(option)}
              className="peer sr-only"
            />
            <span className="flex h-20 flex-col justify-between rounded-lg border bg-background/40 p-3 text-sm font-medium transition-colors hover:bg-accent peer-checked:border-primary peer-checked:bg-primary/5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
              <Icon className="size-4 text-muted-foreground" aria-hidden />
              {label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
