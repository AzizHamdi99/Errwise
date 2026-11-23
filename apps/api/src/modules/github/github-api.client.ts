import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';
import type { GithubIssueLink, GithubRepo } from '@errwise/shared';
import type { Env } from '../../config/env';
import {
  GithubReadError,
  MAX_BLOB_BYTES,
  classifyGithubFailure,
  isSafeRepo,
} from './github-read';
import type { BlobText, ExactBlob, RepoTree } from './github-read';

const GITHUB_API = 'https://api.github.com';
const GITHUB_OAUTH_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const REQUEST_TIMEOUT_MS = 10_000;
const TOKEN_SAFETY_MARGIN_MS = 5 * 60_000;
const PER_PAGE = 100;
const MAX_PAGES = 5;
// Values that end up inside a request path are checked again here, whatever the caller did.
const COMMIT_PATTERN = /^[0-9a-f]{7,64}$/;
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$|^[0-9a-f]{64}$/;
const BINARY_SNIFF_BYTES = 8_000;
const MAX_CACHED_TOKENS = 500;

/**
 * What an installation token may do. The App itself may hold more (Contents: write is added
 * for AI fixes, ADR-009), but each call asks for the least it needs, so a bug or a leak in
 * the issue or read paths can never write code. Metadata (read) is always granted by GitHub.
 */
export type TokenPurpose = 'metadata' | 'issues' | 'read' | 'fix';

const TOKEN_PERMISSIONS: Record<
  TokenPurpose,
  Record<string, 'read' | 'write'>
> = {
  metadata: { metadata: 'read' },
  issues: { issues: 'write' },
  read: { contents: 'read' },
  fix: { contents: 'write', pull_requests: 'write' },
};

/**
 * GitHub refused to mint a token with the requested permissions: the installation owner has
 * not accepted them yet, or the repository is not part of the installation. A BadGateway for
 * every caller that does not care, and "no permission" for the code reader.
 */
export class GithubTokenError extends BadGatewayException {
  constructor() {
    super('GitHub request failed');
  }
}

const treeSchema = z.object({
  truncated: z.boolean().optional(),
  tree: z.array(
    z.object({
      path: z.string(),
      type: z.string(),
      sha: z.string(),
      size: z.number().optional(),
      mode: z.string().optional(),
    }),
  ),
});

const commitSchema = z.object({ tree: z.object({ sha: z.string() }) });
// Only regular files are written back: never a symlink (120000) or a submodule (160000).
const WRITABLE_MODES: ReadonlySet<string> = new Set(['100644', '100755']);

// A link that is stored and shown must point at GitHub itself.
const githubUrl = z.url().refine((u) => u.startsWith('https://github.com/'));
const pullRequestSchema = z.object({
  number: z.number().int().positive(),
  html_url: githubUrl,
});
const pullRequestListSchema = z.array(pullRequestSchema);
const problemSchema = z.object({
  message: z.string().optional(),
  errors: z
    .array(z.union([z.string(), z.object({ message: z.string().optional() })]))
    .optional(),
});

export interface GithubPullRequest {
  number: number;
  url: string;
}

const branchInfoSchema = z.object({ default_branch: z.string() });
const refSchema = z.object({ object: z.object({ sha: z.string() }) });

/**
 * A branch name that goes into a request path. Git allows more than this, but a default branch
 * with other characters is unheard of, and "unavailable" is a safe answer for it.
 */
function isSafeBranch(branch: string): boolean {
  return (
    branch.length > 0 &&
    branch.length <= 255 &&
    /^[A-Za-z0-9._/-]+$/.test(branch) &&
    branch.split('/').every((s) => s !== '' && s !== '.' && s !== '..')
  );
}

/** Slashes stay: "errwise/fix-x" is the path segments "errwise" and "fix-x". */
function encodeBranch(branch: string): string {
  return branch.split('/').map(encodeURIComponent).join('/');
}

interface RequestOptions {
  token: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

/** The only place that talks to GitHub. Never logs tokens or response bodies. */
@Injectable()
export class GithubApiClient {
  private readonly logger = new Logger(GithubApiClient.name);
  private readonly appId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly privateKey: string;
  // Keyed by installation, purpose and repository: a narrow token must never be served
  // where a wider one was asked for, or the other way round.
  private readonly installationTokens = new Map<
    string,
    { token: string; expiresAt: number }
  >();

  constructor(
    config: ConfigService<Env, true>,
    private readonly jwt: JwtService,
  ) {
    this.appId = config.get('GITHUB_APP_ID', { infer: true });
    this.clientId = config.get('GITHUB_APP_CLIENT_ID', { infer: true });
    this.clientSecret = config.get('GITHUB_APP_CLIENT_SECRET', { infer: true });
    this.privateKey = Buffer.from(
      config.get('GITHUB_APP_PRIVATE_KEY_BASE64', { infer: true }),
      'base64',
    ).toString('utf8');
  }

  /** Exchanges the OAuth code from the redirect for a short-lived user token. */
  async exchangeUserCode(code: string): Promise<string> {
    const res = await this.send(GITHUB_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
      }),
    });
    const data = (await res.json()) as {
      access_token?: string;
      error?: string;
    };
    if (!res.ok || !data.access_token) {
      this.logger.warn(
        `OAuth code exchange failed: ${data.error ?? res.status}`,
      );
      throw new BadRequestException(
        'GitHub authorization is invalid or expired',
      );
    }
    return data.access_token;
  }

  /** True only if this GitHub user can access the installation. Blocks forged ids. */
  async userCanAccessInstallation(
    userToken: string,
    installationId: string,
  ): Promise<boolean> {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await this.json<{ installations: { id: number }[] }>(
        `/user/installations?per_page=${PER_PAGE}&page=${page}`,
        { token: userToken },
      );
      if (data.installations.some((i) => String(i.id) === installationId)) {
        return true;
      }
      if (data.installations.length < PER_PAGE) return false;
    }
    return false;
  }

  async listRepositories(installationId: string): Promise<GithubRepo[]> {
    const token = await this.getInstallationToken(installationId, 'metadata');
    const repos: GithubRepo[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await this.json<{
        repositories: { full_name: string; private: boolean }[];
      }>(`/installation/repositories?per_page=${PER_PAGE}&page=${page}`, {
        token,
      });
      repos.push(
        ...data.repositories.map((r) => ({
          fullName: r.full_name,
          private: r.private,
        })),
      );
      if (data.repositories.length < PER_PAGE) break;
    }
    return repos;
  }

  /**
   * Labels are decoration: GitHub answers 422 when it refuses one (a label name it does not
   * accept, or an app that may not create labels). The issue is worth more than its labels,
   * so that case is retried once without them.
   */
  async createIssue(
    installationId: string,
    repo: string,
    input: { title: string; body: string; labels?: string[] },
  ): Promise<GithubIssueLink> {
    const token = await this.getInstallationToken(
      installationId,
      'issues',
      repo,
    );
    const path = `/repos/${repo}/issues`;

    let res = await this.request(path, { token, method: 'POST', body: input });
    if (res.status === 422 && input.labels?.length) {
      this.logger.warn('GitHub refused the labels, creating the issue without');
      const { title, body } = input;
      res = await this.request(path, {
        token,
        method: 'POST',
        body: { title, body },
      });
    }
    const data = await this.parse<{ number: number; html_url: string }>(
      res,
      'POST',
      path,
    );
    return { number: data.number, url: data.html_url };
  }

  async reopenIssue(
    installationId: string,
    repo: string,
    number: number,
  ): Promise<void> {
    const token = await this.getInstallationToken(
      installationId,
      'issues',
      repo,
    );
    await this.json(`/repos/${repo}/issues/${number}`, {
      token,
      method: 'PATCH',
      body: { state: 'open', state_reason: 'reopened' },
    });
  }

  async commentOnIssue(
    installationId: string,
    repo: string,
    number: number,
    body: string,
  ): Promise<void> {
    const token = await this.getInstallationToken(
      installationId,
      'issues',
      repo,
    );
    await this.json(`/repos/${repo}/issues/${number}/comments`, {
      token,
      method: 'POST',
      body: { body },
    });
  }

  // Reads below serve the optional source code feature. They throw GithubReadError, never
  // a generic exception, because the caller must tell "no permission" from "rate limited".

  /** Turns a commit hash, possibly a short one, into the full one. Also proves it exists. */
  async resolveCommit(
    installationId: string,
    repo: string,
    commit: string,
  ): Promise<string> {
    if (!isSafeRepo(repo) || !COMMIT_PATTERN.test(commit)) {
      throw new GithubReadError('not_found');
    }
    const res = await this.read(
      installationId,
      repo,
      `/repos/${repo}/commits/${commit}`,
      'application/vnd.github.sha',
    );
    const sha = (await res.text()).trim().toLowerCase();
    if (!FULL_SHA_PATTERN.test(sha)) throw new GithubReadError('unavailable');
    return sha;
  }

  /** Every file of a commit. */
  async getTree(
    installationId: string,
    repo: string,
    commitSha: string,
  ): Promise<RepoTree> {
    if (!isSafeRepo(repo) || !FULL_SHA_PATTERN.test(commitSha)) {
      throw new GithubReadError('not_found');
    }
    const res = await this.read(
      installationId,
      repo,
      `/repos/${repo}/git/trees/${commitSha}?recursive=1`,
      'application/vnd.github+json',
    );
    const parsed = treeSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new GithubReadError('unavailable');

    const files: RepoTree['files'] = new Map();
    for (const entry of parsed.data.tree) {
      if (entry.type === 'blob' && FULL_SHA_PATTERN.test(entry.sha)) {
        files.set(entry.path, {
          sha: entry.sha,
          size: entry.size ?? 0,
          ...(entry.mode ? { mode: entry.mode } : {}),
        });
      }
    }
    return { files, truncated: parsed.data.truncated === true };
  }

  /** The text of one file, by blob id. Binary and very large files are reported, not read. */
  async getBlobText(
    installationId: string,
    repo: string,
    blobSha: string,
  ): Promise<BlobText> {
    if (!isSafeRepo(repo) || !FULL_SHA_PATTERN.test(blobSha)) {
      throw new GithubReadError('not_found');
    }
    const res = await this.read(
      installationId,
      repo,
      `/repos/${repo}/git/blobs/${blobSha}`,
      'application/vnd.github.raw+json',
    );
    const declared = Number(res.headers.get('content-length'));
    if (declared > MAX_BLOB_BYTES) return { kind: 'too_large' };

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_BLOB_BYTES) return { kind: 'too_large' };
    // A NUL byte early in the file is how Git itself decides a file is binary.
    if (bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0)) {
      return { kind: 'binary' };
    }
    return { kind: 'text', text: new TextDecoder('utf-8').decode(bytes) };
  }

  /**
   * The default branch and the commit it points at right now. A fix is checked against it
   * (ADR-009): code that has already changed since the deploy is not worth a model call.
   */
  async getDefaultBranchHead(
    installationId: string,
    repo: string,
  ): Promise<{ branch: string; sha: string }> {
    if (!isSafeRepo(repo)) throw new GithubReadError('not_found');

    const info = branchInfoSchema.safeParse(
      await (
        await this.read(
          installationId,
          repo,
          `/repos/${repo}`,
          'application/vnd.github+json',
        )
      )
        .json()
        .catch(() => null),
    );
    if (!info.success || !isSafeBranch(info.data.default_branch)) {
      throw new GithubReadError('unavailable');
    }
    const branch = info.data.default_branch;

    // Slashes stay: a branch "release/1.x" is the path segments "release" and "1.x".
    const encoded = encodeBranch(branch);
    const ref = refSchema.safeParse(
      await (
        await this.read(
          installationId,
          repo,
          `/repos/${repo}/git/ref/heads/${encoded}`,
          'application/vnd.github+json',
        )
      )
        .json()
        .catch(() => null),
    );
    const sha = ref.success ? ref.data.object.sha.toLowerCase() : '';
    if (!FULL_SHA_PATTERN.test(sha)) throw new GithubReadError('unavailable');
    return { branch, sha };
  }

  // --- Opening a pull request with a fix (ADR-009) ---------------------------------------------
  // Reads here are exact (every byte of a file is written back), writes use the "fix" token,
  // the only one that may change code, limited to the one repository. Nothing here ever logs
  // a file, a message or a response body.

  /** The tree a commit is made of: the base of the tree of a new commit. */
  async getCommitTree(
    installationId: string,
    repo: string,
    commitSha: string,
  ): Promise<string> {
    if (!isSafeRepo(repo) || !FULL_SHA_PATTERN.test(commitSha)) {
      throw new GithubReadError('not_found');
    }
    const res = await this.read(
      installationId,
      repo,
      `/repos/${repo}/git/commits/${commitSha}`,
      'application/vnd.github+json',
    );
    const parsed = commitSchema.safeParse(await res.json().catch(() => null));
    const sha = parsed.success ? parsed.data.tree.sha.toLowerCase() : '';
    if (!FULL_SHA_PATTERN.test(sha)) throw new GithubReadError('unavailable');
    return sha;
  }

  /** A file as it is, to be written back: see ExactBlob. */
  async getBlobExact(
    installationId: string,
    repo: string,
    blobSha: string,
  ): Promise<ExactBlob> {
    if (!isSafeRepo(repo) || !FULL_SHA_PATTERN.test(blobSha)) {
      throw new GithubReadError('not_found');
    }
    const res = await this.read(
      installationId,
      repo,
      `/repos/${repo}/git/blobs/${blobSha}`,
      'application/vnd.github.raw+json',
    );
    const declared = Number(res.headers.get('content-length'));
    if (declared > MAX_BLOB_BYTES) return { kind: 'too_large' };

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_BLOB_BYTES) return { kind: 'too_large' };
    if (bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0)) {
      return { kind: 'binary' };
    }
    try {
      // fatal: broken UTF-8 throws instead of becoming U+FFFD. ignoreBOM: the mark stays in
      // the text, so writing it back leaves the file's first bytes alone.
      const text = new TextDecoder('utf-8', {
        fatal: true,
        ignoreBOM: true,
      }).decode(bytes);
      return { kind: 'text', text };
    } catch {
      return { kind: 'invalid_utf8' };
    }
  }

  /** The commit a branch points at, or null when the repository has no such branch. */
  async getBranchHead(
    installationId: string,
    repo: string,
    branch: string,
  ): Promise<string | null> {
    if (!isSafeRepo(repo) || !isSafeBranch(branch)) {
      throw new GithubReadError('not_found');
    }
    let res: Response;
    try {
      res = await this.read(
        installationId,
        repo,
        `/repos/${repo}/git/ref/heads/${encodeBranch(branch)}`,
        'application/vnd.github+json',
      );
    } catch (error) {
      if (error instanceof GithubReadError && error.kind === 'not_found') {
        return null;
      }
      throw error;
    }
    const parsed = refSchema.safeParse(await res.json().catch(() => null));
    const sha = parsed.success ? parsed.data.object.sha.toLowerCase() : '';
    if (!FULL_SHA_PATTERN.test(sha)) throw new GithubReadError('unavailable');
    return sha;
  }

  /** The pull request opened from a branch, whatever its state, or null. */
  async findPullRequest(
    installationId: string,
    repo: string,
    branch: string,
  ): Promise<GithubPullRequest | null> {
    if (!isSafeRepo(repo) || !isSafeBranch(branch)) {
      throw new BadGatewayException('GitHub request failed');
    }
    const owner = repo.split('/')[0];
    const path = `/repos/${repo}/pulls?head=${encodeURIComponent(`${owner}:${branch}`)}&state=all&per_page=1`;
    const res = await this.fixRequest(installationId, repo, 'GET', path);
    const data = await this.parse<unknown>(res, 'GET', path);
    const parsed = pullRequestListSchema.safeParse(data);
    if (!parsed.success) throw new BadGatewayException('GitHub request failed');
    const found = parsed.data[0];
    return found ? { number: found.number, url: found.html_url } : null;
  }

  async createBlob(
    installationId: string,
    repo: string,
    text: string,
  ): Promise<string> {
    const path = `/repos/${repo}/git/blobs`;
    const res = await this.fixRequest(installationId, repo, 'POST', path, {
      // Base64 of the exact bytes: nothing in the text can be altered on the way.
      content: Buffer.from(text, 'utf8').toString('base64'),
      encoding: 'base64',
    });
    return this.createdSha(res, path);
  }

  async createTree(
    installationId: string,
    repo: string,
    baseTree: string,
    entries: { path: string; mode: string; sha: string }[],
  ): Promise<string> {
    const valid =
      FULL_SHA_PATTERN.test(baseTree) &&
      entries.length > 0 &&
      entries.every(
        (e) =>
          WRITABLE_MODES.has(e.mode) &&
          FULL_SHA_PATTERN.test(e.sha) &&
          e.path.length > 0,
      );
    if (!valid) throw new BadGatewayException('GitHub request failed');

    const path = `/repos/${repo}/git/trees`;
    const res = await this.fixRequest(installationId, repo, 'POST', path, {
      base_tree: baseTree,
      tree: entries.map((e) => ({ ...e, type: 'blob' })),
    });
    return this.createdSha(res, path);
  }

  /** The commit is made by the app: no author or committer of ours is claimed. */
  async createCommit(
    installationId: string,
    repo: string,
    input: { message: string; tree: string; parent: string },
  ): Promise<string> {
    if (
      !FULL_SHA_PATTERN.test(input.tree) ||
      !FULL_SHA_PATTERN.test(input.parent)
    ) {
      throw new BadGatewayException('GitHub request failed');
    }
    const path = `/repos/${repo}/git/commits`;
    const res = await this.fixRequest(installationId, repo, 'POST', path, {
      message: input.message,
      tree: input.tree,
      parents: [input.parent],
    });
    return this.createdSha(res, path);
  }

  /** Never moves a branch: "exists" is an answer, not something to overwrite. */
  async createBranch(
    installationId: string,
    repo: string,
    branch: string,
    commitSha: string,
  ): Promise<'created' | 'exists'> {
    if (!isSafeBranch(branch) || !FULL_SHA_PATTERN.test(commitSha)) {
      throw new BadGatewayException('GitHub request failed');
    }
    const path = `/repos/${repo}/git/refs`;
    const res = await this.fixRequest(installationId, repo, 'POST', path, {
      ref: `refs/heads/${branch}`,
      sha: commitSha,
    });
    if (res.status === 422) return 'exists';
    await this.parse<unknown>(res, 'POST', path);
    return 'created';
  }

  /** Only for a branch that this call created and could not use. */
  async deleteBranch(
    installationId: string,
    repo: string,
    branch: string,
  ): Promise<void> {
    if (!isSafeBranch(branch)) {
      throw new BadGatewayException('GitHub request failed');
    }
    const path = `/repos/${repo}/git/refs/heads/${encodeBranch(branch)}`;
    const res = await this.fixRequest(installationId, repo, 'DELETE', path);
    // Already gone is as good as deleted.
    if (res.status === 204 || res.status === 404 || res.status === 422) return;
    await this.parse<unknown>(res, 'DELETE', path);
  }

  /**
   * Always a draft: a human decides when it is ready. Where GitHub does not offer drafts
   * (private repositories of some plans) this says so, and never falls back to a normal pull
   * request, because a draft is what keeps auto-merge from merging AI code.
   */
  async createPullRequest(
    installationId: string,
    repo: string,
    input: { title: string; body: string; head: string; base: string },
  ): Promise<
    | { kind: 'created'; pullRequest: GithubPullRequest }
    | { kind: 'exists' }
    | { kind: 'draft_unsupported' }
  > {
    if (!isSafeBranch(input.head) || !isSafeBranch(input.base)) {
      throw new BadGatewayException('GitHub request failed');
    }
    const path = `/repos/${repo}/pulls`;
    const res = await this.fixRequest(installationId, repo, 'POST', path, {
      ...input,
      draft: true,
    });
    if (res.status === 422) {
      const problem = await this.problemText(res);
      if (/already exists/i.test(problem)) return { kind: 'exists' };
      if (/draft pull requests? (are|is) not supported/i.test(problem)) {
        return { kind: 'draft_unsupported' };
      }
    }
    const data = await this.parse<unknown>(res, 'POST', path);
    const parsed = pullRequestSchema.safeParse(data);
    if (!parsed.success) throw new BadGatewayException('GitHub request failed');
    return {
      kind: 'created',
      pullRequest: {
        number: parsed.data.number,
        url: parsed.data.html_url,
      },
    };
  }

  /** The "fix" token, and a refusal of the permission as one kind of error. */
  private async fixRequest(
    installationId: string,
    repo: string,
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<Response> {
    if (!isSafeRepo(repo))
      throw new BadGatewayException('GitHub request failed');
    const token = await this.getInstallationToken(installationId, 'fix', repo);
    const res = await this.request(path, { token, method, body });
    if (res.status === 401 || res.status === 403) {
      // "Resource not accessible by integration": the installation has not accepted the
      // write permissions. Same meaning as a refused token request.
      this.logger.warn(`GitHub refused a write (${res.status})`);
      throw new GithubTokenError();
    }
    return res;
  }

  private async createdSha(res: Response, path: string): Promise<string> {
    const data = await this.parse<{ sha?: string }>(res, 'POST', path);
    const sha = typeof data.sha === 'string' ? data.sha.toLowerCase() : '';
    if (!FULL_SHA_PATTERN.test(sha)) {
      throw new BadGatewayException('GitHub request failed');
    }
    return sha;
  }

  /** Only to tell one 422 from another. Never logged, never returned. */
  private async problemText(res: Response): Promise<string> {
    const parsed = problemSchema.safeParse(
      await res
        .clone()
        .json()
        .catch(() => null),
    );
    if (!parsed.success) return '';
    const { message, errors } = parsed.data;
    return [
      message,
      ...(errors ?? []).map((e) => (typeof e === 'string' ? e : e.message)),
    ]
      .filter((t): t is string => typeof t === 'string')
      .join(' ');
  }

  /** Never logs the path (it names the repository) or the content, only the status. */
  private async read(
    installationId: string,
    repo: string,
    path: string,
    accept: string,
  ): Promise<Response> {
    let token: string;
    try {
      token = await this.getInstallationToken(installationId, 'read', repo);
    } catch (error) {
      // Not accepted yet (or repository outside the installation): same message to the user
      // as a 403 on the read itself, "accept the permission".
      throw new GithubReadError(
        error instanceof GithubTokenError ? 'forbidden' : 'unavailable',
      );
    }

    let res: Response;
    try {
      res = await fetch(`${GITHUB_API}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: accept,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'errwise',
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new GithubReadError('unavailable');
    }

    if (res.ok) return res;
    this.logger.warn(`GitHub read failed with ${res.status}`);
    throw new GithubReadError(classifyGithubFailure(res.status, res.headers));
  }

  /**
   * Short-lived installation token (about 1 hour), cached in memory. It is limited to the
   * permissions of `purpose` and, when a repository is given, to that repository alone.
   */
  async getInstallationToken(
    installationId: string,
    purpose: TokenPurpose,
    repo?: string,
  ): Promise<string> {
    if (repo !== undefined && !isSafeRepo(repo)) {
      throw new BadGatewayException('GitHub request failed');
    }
    const key = `${installationId}:${purpose}:${repo ?? '*'}`;
    const cached = this.installationTokens.get(key);
    if (cached && cached.expiresAt - Date.now() > TOKEN_SAFETY_MARGIN_MS) {
      return cached.token;
    }

    const path = `/app/installations/${installationId}/access_tokens`;
    const res = await this.request(path, {
      token: await this.createAppJwt(),
      method: 'POST',
      body: {
        permissions: TOKEN_PERMISSIONS[purpose],
        // The API wants the repository name, without the owner.
        ...(repo ? { repositories: [repo.split('/')[1]] } : {}),
      },
    });
    if (res.status === 422) {
      this.logger.warn(`GitHub refused a ${purpose} token (422)`);
      throw new GithubTokenError();
    }
    const data = await this.parse<{ token: string; expires_at: string }>(
      res,
      'POST',
      path,
    );

    this.rememberToken(key, {
      token: data.token,
      expiresAt: new Date(data.expires_at).getTime(),
    });
    return data.token;
  }

  /** Expired tokens leave first, so the map stays small even with many repositories. */
  private rememberToken(
    key: string,
    entry: { token: string; expiresAt: number },
  ): void {
    if (this.installationTokens.size >= MAX_CACHED_TOKENS) {
      const now = Date.now();
      for (const [k, v] of this.installationTokens) {
        if (v.expiresAt <= now) this.installationTokens.delete(k);
      }
      if (this.installationTokens.size >= MAX_CACHED_TOKENS) {
        this.installationTokens.clear();
      }
    }
    this.installationTokens.set(key, entry);
  }

  private createAppJwt(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return this.jwt.signAsync(
      {
        iss: this.appId,
        iat: now - 60, // tolerates small clock drift
        exp: now + 9 * 60, // GitHub allows 10 minutes at most
      },
      { algorithm: 'RS256', privateKey: this.privateKey },
    );
  }

  private async json<T>(path: string, opts: RequestOptions): Promise<T> {
    const res = await this.request(path, opts);
    return this.parse<T>(res, opts.method ?? 'GET', path);
  }

  private request(path: string, opts: RequestOptions): Promise<Response> {
    return this.send(`${GITHUB_API}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${opts.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'errwise',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  }

  /** Logs the status only, never the body (it can echo what we sent). */
  private async parse<T>(
    res: Response,
    method: string,
    path: string,
  ): Promise<T> {
    if (!res.ok) {
      this.logger.warn(`GitHub ${method} ${path} failed with ${res.status}`);
      throw new BadGatewayException('GitHub request failed');
    }
    return (await res.json()) as T;
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new BadGatewayException('GitHub is unreachable');
    }
  }
}
