export const DEFAULT_REDIRECT = "/organizations";

export function safeNext(next: string | null | undefined): string {
  if (
    next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  ) {
    return next;
  }
  return DEFAULT_REDIRECT;
}
