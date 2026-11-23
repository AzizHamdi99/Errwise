/** Why a read from GitHub failed. Each one needs a different message for the user. */
export type GithubReadErrorKind =
  | 'not_found' // unknown commit, file or repository
  | 'forbidden' // the app has no access to the repository's contents
  | 'rate_limited'
  | 'unavailable'; // network, timeout, GitHub down, or an answer we cannot read

export class GithubReadError extends Error {
  constructor(readonly kind: GithubReadErrorKind) {
    super(`GitHub read failed: ${kind}`);
    this.name = 'GithubReadError';
  }
}

export interface RepoFile {
  /** Git blob id: the content never changes for a given id. */
  sha: string;
  size: number;
  /**
   * Git file mode: "100644" a file, "100755" an executable, "120000" a symlink, "160000" a
   * submodule. Writing a file back needs it, and only the first two may be written.
   */
  mode?: string;
}

export interface RepoTree {
  /** Every file of the commit, by repository path. */
  files: Map<string, RepoFile>;
  /** GitHub caps very large trees. Files past the cap are simply missing. */
  truncated: boolean;
}

export type BlobText =
  { kind: 'text'; text: string } | { kind: 'binary' } | { kind: 'too_large' };

/**
 * A file read to be written back: every byte counts, so unlike BlobText the byte order mark
 * stays in the text, and bytes that are not UTF-8 are a refusal, never a replacement character.
 */
export type ExactBlob =
  | { kind: 'text'; text: string }
  | { kind: 'binary' }
  | { kind: 'too_large' }
  | { kind: 'invalid_utf8' };

export const MAX_BLOB_BYTES = 512 * 1024;

const REPO_PATTERN = /^[A-Za-z0-9_.-]+[/][A-Za-z0-9_.-]+$/;

/**
 * "owner/name" and nothing else. The characters alone are not enough: ".." is made of
 * allowed characters, and "../x" in a request path walks out of /repos/.
 */
export function isSafeRepo(repo: string): boolean {
  return (
    REPO_PATTERN.test(repo) &&
    repo.split('/').every((part) => part !== '.' && part !== '..')
  );
}

/** A rate limit is also a 403, and it is told apart by its headers. */
export function classifyGithubFailure(
  status: number,
  headers: Pick<Headers, 'get'>,
): GithubReadErrorKind {
  if (status === 429) return 'rate_limited';
  if (status === 403) {
    const limited =
      headers.get('x-ratelimit-remaining') === '0' ||
      headers.get('retry-after') !== null;
    return limited ? 'rate_limited' : 'forbidden';
  }
  if (status === 401) return 'forbidden';
  // 409 is an empty repository and 422 an invalid object: nothing to read there either.
  if (status === 404 || status === 409 || status === 422) return 'not_found';
  return 'unavailable';
}
