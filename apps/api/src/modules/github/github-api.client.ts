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
import type { BlobText, RepoTree } from './github-read';

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

const treeSchema = z.object({
  truncated: z.boolean().optional(),
  tree: z.array(
    z.object({
      path: z.string(),
      type: z.string(),
      sha: z.string(),
      size: z.number().optional(),
    }),
  ),
});

interface RequestOptions {
  token: string;
  method?: 'GET' | 'POST' | 'PATCH';
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
    const token = await this.getInstallationToken(installationId);
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
  async createIssue(
    installationId: string,
    repo: string,
    input: { title: string; body: string },
  ): Promise<GithubIssueLink> {
    const token = await this.getInstallationToken(installationId);
    const data = await this.json<{ number: number; html_url: string }>(
      `/repos/${repo}/issues`,
      { token, method: 'POST', body: input },
    );
    return { number: data.number, url: data.html_url };
  }

  async reopenIssue(
    installationId: string,
    repo: string,
    number: number,
  ): Promise<void> {
    const token = await this.getInstallationToken(installationId);
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
    const token = await this.getInstallationToken(installationId);
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
      `/repos/${repo}/git/trees/${commitSha}?recursive=1`,
      'application/vnd.github+json',
    );
    const parsed = treeSchema.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new GithubReadError('unavailable');

    const files: RepoTree['files'] = new Map();
    for (const entry of parsed.data.tree) {
      if (entry.type === 'blob' && FULL_SHA_PATTERN.test(entry.sha)) {
        files.set(entry.path, { sha: entry.sha, size: entry.size ?? 0 });
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

  /** Never logs the path (it names the repository) or the content, only the status. */
  private async read(
    installationId: string,
    path: string,
    accept: string,
  ): Promise<Response> {
    let token: string;
    try {
      token = await this.getInstallationToken(installationId);
    } catch {
      throw new GithubReadError('unavailable');
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

  /** Short-lived installation token (about 1 hour), cached in memory. */
  async getInstallationToken(installationId: string): Promise<string> {
    const cached = this.installationTokens.get(installationId);
    if (cached && cached.expiresAt - Date.now() > TOKEN_SAFETY_MARGIN_MS) {
      return cached.token;
    }
    const data = await this.json<{ token: string; expires_at: string }>(
      `/app/installations/${installationId}/access_tokens`,
      { token: await this.createAppJwt(), method: 'POST' },
    );
    this.installationTokens.set(installationId, {
      token: data.token,
      expiresAt: new Date(data.expires_at).getTime(),
    });
    return data.token;
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
    const method = opts.method ?? 'GET';
    const res = await this.send(`${GITHUB_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${opts.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'errwise',
        ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
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
