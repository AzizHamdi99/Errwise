interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
  /** No padding around the body, for lists that go edge to edge. */
  flush?: boolean;
}

export function Panel({ title, description, children, flush }: Props) {
  return (
    <section aria-label={title} className="rounded-xl border bg-card">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div className={flush ? undefined : "p-4"}>{children}</div>
    </section>
  );
}
