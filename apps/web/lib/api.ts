const BASE = "/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown };

function request(path: string, { method = "GET", body }: Options) {
  return fetch(BASE + path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// The access token lasts 15 minutes. When it expires we refresh once,
// even if several requests fail at the same time.
let refreshing: Promise<boolean> | null = null;
function refresh() {
  refreshing ??= request("/auth/refresh", { method: "POST" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => (refreshing = null));
  return refreshing;
}

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  let res = await request(path, options);

  if (res.status === 401 && !path.startsWith("/auth/") && (await refresh())) {
    res = await request(path, options);
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as {
      message?: unknown;
      errors?: ApiError["fieldErrors"];
    };
    const message =
      typeof data.message === "string" ? data.message : "Something went wrong";
    throw new ApiError(res.status, message, data.errors);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Text that is safe to show to the user. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status < 500) return error.message;
  return "Something went wrong. Please try again.";
}
