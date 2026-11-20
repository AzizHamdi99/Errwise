// Variables that hosting and CI platforms already set to the deployed commit.
// The first valid one wins, so most users configure nothing.
const COMMIT_ENV_VARS = [
  "ERRWISE_COMMIT_SHA",
  "VERCEL_GIT_COMMIT_SHA",
  "GITHUB_SHA",
  "RENDER_GIT_COMMIT",
  "RAILWAY_GIT_COMMIT_SHA",
  "SOURCE_VERSION", // Heroku
  "CF_PAGES_COMMIT_SHA",
] as const;

// The same pattern the API enforces (a Git object id: 7 to 64 hex characters).
const COMMIT_PATTERN = /^[0-9a-f]{7,64}$/;

/** A lowercase commit hash, or undefined. Bad values are ignored: the SDK never throws. */
export function normalizeCommitSha(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const sha = value.trim().toLowerCase();
  return COMMIT_PATTERN.test(sha) ? sha : undefined;
}

/** The explicit option first, then the platform variables. */
export function resolveCommit(
  option: unknown,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  for (const candidate of [option, ...COMMIT_ENV_VARS.map((n) => env[n])]) {
    const sha = normalizeCommitSha(candidate);
    if (sha) return sha;
  }
  return undefined;
}
