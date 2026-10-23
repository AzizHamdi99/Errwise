import { cn } from "@/lib/utils";

function getScore(password: string): 0 | 1 | 2 | 3 {
  if (password.length < 8) return 0;
  let score = 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)) {
    score += 1;
  }
  return Math.min(score, 3) as 1 | 2 | 3;
}

const LEVELS = [
  { label: "Use at least 8 characters.", bar: "bg-border" },
  { label: "Weak. Add length or more character types.", bar: "bg-destructive" },
  { label: "Good. A longer password is even better.", bar: "bg-amber-500" },
  { label: "Strong password.", bar: "bg-emerald-500" },
] as const;

export function PasswordStrength({ password }: { password: string }) {
  const score = getScore(password);
  const level = LEVELS[score];

  return (
    <div className="space-y-2">
      <div aria-hidden className="grid grid-cols-3 gap-1.5">
        {[1, 2, 3].map((segment) => (
          <div
            key={segment}
            className={cn(
              "h-0.5 rounded-full bg-border transition-colors",
              segment <= score && level.bar,
            )}
          />
        ))}
      </div>
      <p aria-live="polite" className="text-xs text-muted-foreground">
        {level.label}
      </p>
    </div>
  );
}
