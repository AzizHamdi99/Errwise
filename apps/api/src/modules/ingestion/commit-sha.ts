/** A Git object id: 7 to 64 hex characters (SHA-1 is 40, SHA-256 is 64). */
const COMMIT_PATTERN = /^[0-9a-f]{7,64}$/;

/**
 * Many teams already set `release` to the commit. Accept it as a commit only when it
 * contains a letter: a release like "20261120" or "1234567" is a date or a build number,
 * and treating it as a commit would only send GitHub lookups that fail.
 * (The price: a real short commit made only of digits is not recognized.)
 */
export function commitFromRelease(
  release: string | undefined,
): string | undefined {
  const value = release?.trim().toLowerCase();
  if (!value || !COMMIT_PATTERN.test(value) || !/[a-f]/.test(value)) {
    return undefined;
  }
  return value;
}

/** The explicit commit from the SDK wins. Otherwise the release, when it looks like one. */
export function resolveCommitSha(
  commitSha: string | undefined,
  release: string | undefined,
): string | undefined {
  return commitSha ?? commitFromRelease(release);
}
