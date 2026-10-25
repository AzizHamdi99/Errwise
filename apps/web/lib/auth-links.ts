interface Options {
  next?: string | null;
  email?: string | null;
}

export function authHref(
  path: "/login" | "/register",
  { next, email }: Options = {},
): string {
  const params = new URLSearchParams();
  if (next) params.set("next", next);
  if (email) params.set("email", email);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
