/**
 * Maps the path of a stack frame to a file of the repository.
 *
 * A frame path is chosen by the monitored app, so it is untrusted input. It is never used to
 * build a request: it only selects among paths that really exist in the repository tree, and
 * the answer is always one of them. When the evidence is not strong enough the answer is "no
 * file", because showing the wrong code is worse than showing none.
 *
 * Pure logic, no I/O.
 */

export type UnresolvedReason =
  | 'library' // node_modules, node: internals, anonymous code: not the app's own code
  | 'compiled' // build output (dist/, build/...) whose lines do not match the source
  | 'ambiguous' // several repository files match equally well
  | 'not_found'; // no file of that name, or only a weak match

export type PathResolution =
  { ok: true; path: string } | { ok: false; reason: UnresolvedReason };

interface IndexedFile {
  path: string;
  segments: string[];
}

export interface RepoIndex {
  /** File name to every repository file with that name. */
  byName: Map<string, IndexedFile[]>;
}

const BACKSLASH = String.fromCharCode(92);
const MAX_PATH_LENGTH = 1_024;
// Directories where tools write compiled output. A frame in one of them points at generated
// code, even when a file of the same name exists in the sources.
const BUILD_DIRS = new Set([
  'dist',
  'build',
  'out',
  '.next',
  '.output',
  '.nuxt',
  '.vercel',
  '.serverless',
]);
// The file name plus its folder. Matching the name alone is too weak: "index.ts" exists
// everywhere.
const MIN_MATCHING_SEGMENTS = 2;

/** Windows paths, file:// URLs, webpack:// URLs and query strings all become path segments. */
export function framePathSegments(file: string): string[] {
  let path =
    file.length > MAX_PATH_LENGTH ? file.slice(-MAX_PATH_LENGTH) : file;
  path = path.replace(/[?#].*$/, '');
  try {
    path = decodeURIComponent(path);
  } catch {
    // not valid percent-encoding: keep the text as it is
  }
  path = path
    .split(BACKSLASH)
    .join('/')
    .replace(/^(?:file|webpack|webpack-internal):[/]*/i, '')
    .replace(/^[a-zA-Z]:/, '');

  // "." and ".." are dropped, never followed: a path can not climb out of anything here.
  return path.split('/').filter((s) => s !== '' && s !== '.' && s !== '..');
}

function isLibrary(file: string, segments: string[]): boolean {
  return (
    segments.length === 0 ||
    file.startsWith('node:') ||
    file.includes('<') || // "<anonymous>", "<eval>"
    segments[0] === 'internal' ||
    segments.includes('node_modules')
  );
}

export function buildRepoIndex(paths: readonly string[]): RepoIndex {
  const byName = new Map<string, IndexedFile[]>();
  for (const path of paths) {
    if (path.length > MAX_PATH_LENGTH) continue;
    const segments = path.split('/');
    if (segments.includes('node_modules')) continue;
    const name = segments[segments.length - 1];
    if (!name) continue;
    const files = byName.get(name);
    if (files) files.push({ path, segments });
    else byName.set(name, [{ path, segments }]);
  }
  return { byName };
}

/** How many path segments, counted from the end, are equal. */
function matchingSuffix(a: string[], b: string[]): number {
  let count = 0;
  const limit = Math.min(a.length, b.length);
  while (count < limit && a[a.length - 1 - count] === b[b.length - 1 - count]) {
    count += 1;
  }
  return count;
}

export function resolveRepoPath(
  framePath: string,
  index: RepoIndex,
): PathResolution {
  const segments = framePathSegments(framePath);
  if (isLibrary(framePath, segments)) return { ok: false, reason: 'library' };

  const name = segments[segments.length - 1];
  const buildDir = segments.find((s) => BUILD_DIRS.has(s));
  let pool = index.byName.get(name) ?? [];

  if (buildDir) {
    // Generated code: only a file that lives in the same kind of folder in the repository
    // (committed build output) can have the same lines.
    pool = pool.filter((file) => file.segments.includes(buildDir));
    if (pool.length === 0) return { ok: false, reason: 'compiled' };
  }
  if (pool.length === 0) return { ok: false, reason: 'not_found' };

  let best = 0;
  let winners: IndexedFile[] = [];
  for (const file of pool) {
    const score = matchingSuffix(file.segments, segments);
    if (score > best) {
      best = score;
      winners = [file];
    } else if (score === best) {
      winners.push(file);
    }
  }

  // A frame that is just a file name (a relative path) can only ever match on the name.
  if (best < Math.min(MIN_MATCHING_SEGMENTS, segments.length)) {
    return { ok: false, reason: 'not_found' };
  }
  if (winners.length > 1) return { ok: false, reason: 'ambiguous' };
  return { ok: true, path: winners[0].path };
}
