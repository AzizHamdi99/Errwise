export const DEFAULT_REDIRECT = "/organizations";

export function safeNext(
  next: string | null | undefined,
  fallback = DEFAULT_REDIRECT,
): string {
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  ) {
    return next;
  }
  return fallback;
}
