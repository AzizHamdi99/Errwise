interface StepCardProps {
  step: 1 | 2 | 3;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function StepCard({
  step,
  title,
  description,
  children,
}: StepCardProps) {
  return (
    <section className="rounded-xl border bg-card p-6 sm:p-8">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Step {step} of 3
      </p>
      <h1 className="mt-3 text-2xl font-medium tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}
