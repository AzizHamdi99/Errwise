/** Pulls the method and the URL out of an Express, Fastify or Node request. Returns raw values: event.ts cleans them. */
export function requestInfo(
  request: unknown,
): { method: string; path: string } | undefined {
  if (typeof request !== "object" || request === null) return undefined;
  const { method, originalUrl, url } = request as {
    method?: unknown;
    originalUrl?: unknown;
    url?: unknown;
  };
  // Express: originalUrl keeps the mount path. Fastify and Node: url.
  const path = typeof originalUrl === "string" ? originalUrl : url;
  return typeof method === "string" && typeof path === "string"
    ? { method, path }
    : undefined;
}

/** A 4xx status means the client made a mistake: not a bug in the app. */
export function isClientError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { status, statusCode } = error as {
    status?: unknown;
    statusCode?: unknown;
  };
  const code = typeof status === "number" ? status : statusCode;
  return typeof code === "number" && code >= 400 && code < 500;
}
