/** Decorative grid and a slow glow. Transform and opacity only. */
export function HeroBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--grid-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--grid-line)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)] bg-[size:64px_64px]" />
      <div className="absolute -top-60 left-1/2 h-[640px] w-[1100px] -translate-x-1/2">
        <div className="hero-glow size-full bg-[radial-gradient(closest-side,var(--brand-glow),transparent)]" />
      </div>
    </div>
  );
}
