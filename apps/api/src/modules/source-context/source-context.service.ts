import { Injectable, NotFoundException } from '@nestjs/common';
import { parseStack } from '@errwise/shared';
import type {
  SourceContextResult,
  SourceContextStatus,
  SourceFrame,
  UnresolvedFrameReason,
} from '@errwise/shared';
import { LruCache } from '../../common/utils/lru-cache';
import { mapWithConcurrency } from '../../common/utils/map-with-concurrency';
import { GithubApiClient } from '../github/github-api.client';
import { GithubReadError, MAX_BLOB_BYTES } from '../github/github-read';
import type { BlobText, RepoTree } from '../github/github-read';
import { buildRepoIndex, resolveRepoPath } from './repo-path';
import type { RepoIndex } from './repo-path';
import { SourceContextRepository } from './source-context.repository';
import { CONTEXT_RADIUS, sliceAround } from './source-lines';

const MAX_FRAMES = 10;
const CONCURRENCY = 4;
// A commit never changes, so this is not about freshness. It bounds how long code stays in
// memory, and how long a cached copy can outlive an installation that lost access.
const CACHE_TTL_MS = 10 * 60_000;

interface CachedTree extends RepoTree {
  index: RepoIndex;
}

interface AppFrame {
  frameIndex: number;
  file: string;
  line: number;
}

const STATUS_BY_FAILURE: Record<GithubReadError['kind'], SourceContextStatus> =
  {
    not_found: 'commit_not_found',
    forbidden: 'no_permission',
    rate_limited: 'rate_limited',
    unavailable: 'unavailable',
  };

/** The app's own frames that have a line number, in stack order. */
function appFrames(stack: string | null): AppFrame[] {
  if (!stack) return [];
  const frames: AppFrame[] = [];
  parseStack(stack).frames.forEach((frame, frameIndex) => {
    if (frame.inApp && frame.line !== null) {
      frames.push({ frameIndex, file: frame.file, line: frame.line });
    }
  });
  return frames.slice(0, MAX_FRAMES);
}

function githubUrl(repo: string, commit: string, path: string, line: number) {
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `https://github.com/${repo}/blob/${commit}/${encoded}#L${line}`;
}

/**
 * Shows the code around the failing lines of an event, read from the project's GitHub
 * repository at the commit that was deployed.
 *
 * The code is never stored. Only these in-memory caches hold it, bounded in size and time,
 * and keyed by installation too, so one tenant can never be served what another one read.
 */
@Injectable()
export class SourceContextService {
  private readonly commits = new LruCache<string>({
    maxEntries: 500,
    maxBytes: 100_000,
    ttlMs: CACHE_TTL_MS,
    sizeOf: () => 100,
  });
  private readonly trees = new LruCache<CachedTree>({
    maxEntries: 10,
    maxBytes: 20_000_000,
    ttlMs: CACHE_TTL_MS,
    sizeOf: (tree) => tree.files.size * 150,
  });
  private readonly blobs = new LruCache<BlobText>({
    maxEntries: 300,
    maxBytes: 16_000_000,
    ttlMs: CACHE_TTL_MS,
    sizeOf: (blob) => (blob.kind === 'text' ? blob.text.length * 2 : 64),
  });

  constructor(
    private readonly repo: SourceContextRepository,
    private readonly github: GithubApiClient,
  ) {}

  async get(
    organizationId: string,
    projectId: string,
    issueId: string,
    eventId: string,
  ): Promise<SourceContextResult> {
    const project = await this.repo.findProject(organizationId, projectId);
    if (!project) throw new NotFoundException('Project not found');
    const event = await this.repo.findEvent(projectId, issueId, eventId);
    if (!event) throw new NotFoundException('Event not found');

    const commitSha = event.commitSha;
    const without = (status: SourceContextStatus): SourceContextResult => ({
      status,
      commitSha,
      frames: [],
    });

    if (!project.sourceContextEnabled) return without('disabled');
    const { githubInstallationId: installationId, githubRepo: repo } = project;
    if (!installationId || !repo) return without('not_connected');
    if (!commitSha) return without('no_commit');

    const frames = appFrames(event.stack);
    // Nothing to look up: do not spend GitHub calls.
    if (frames.length === 0) return { status: 'ok', commitSha, frames: [] };

    try {
      const scope = `${installationId}:${repo}`;
      const fullSha = await this.commits.getOrLoad(
        `${scope}:${commitSha}`,
        () => this.github.resolveCommit(installationId, repo, commitSha),
      );
      const tree = await this.trees.getOrLoad(
        `${scope}:${fullSha}`,
        async () => {
          const loaded = await this.github.getTree(
            installationId,
            repo,
            fullSha,
          );
          return { ...loaded, index: buildRepoIndex([...loaded.files.keys()]) };
        },
      );

      const found = await mapWithConcurrency(frames, CONCURRENCY, (frame) =>
        this.frameContext({ installationId, repo, fullSha, tree, frame }),
      );
      return {
        status: 'ok',
        commitSha,
        frames: found.filter((frame): frame is SourceFrame => frame !== null),
      };
    } catch (error) {
      if (error instanceof GithubReadError) {
        return without(STATUS_BY_FAILURE[error.kind]);
      }
      throw error;
    }
  }

  /** Null for frames that are not the app's code (internals, anonymous code). */
  private async frameContext(input: {
    installationId: string;
    repo: string;
    fullSha: string;
    tree: CachedTree;
    frame: AppFrame;
  }): Promise<SourceFrame | null> {
    const { installationId, repo, fullSha, tree, frame } = input;
    const unresolved = (reason: UnresolvedFrameReason): SourceFrame => ({
      frameIndex: frame.frameIndex,
      status: 'unresolved',
      reason,
    });

    const resolution = resolveRepoPath(frame.file, tree.index);
    if (!resolution.ok) {
      return resolution.reason === 'library'
        ? null
        : unresolved(resolution.reason);
    }

    const file = tree.files.get(resolution.path);
    if (!file) return unresolved('not_found');
    if (file.size > MAX_BLOB_BYTES) return unresolved('too_large');

    let blob: BlobText;
    try {
      blob = await this.blobs.getOrLoad(
        `${installationId}:${repo}:${file.sha}`,
        () => this.github.getBlobText(installationId, repo, file.sha),
      );
    } catch (error) {
      // One missing or unreadable file only costs that frame. A missing permission or a
      // rate limit is the same for every frame, so it ends the whole request.
      if (error instanceof GithubReadError) {
        if (error.kind === 'not_found') return unresolved('not_found');
        if (error.kind === 'unavailable') return unresolved('unavailable');
      }
      throw error;
    }
    if (blob.kind !== 'text') return unresolved(blob.kind);

    const window = sliceAround(blob.text, frame.line, CONTEXT_RADIUS);
    if (!window) return unresolved('line_out_of_range');

    return {
      frameIndex: frame.frameIndex,
      status: 'found',
      repoPath: resolution.path,
      line: frame.line,
      startLine: window.startLine,
      lines: window.lines,
      url: githubUrl(repo, fullSha, resolution.path, frame.line),
    };
  }
}
