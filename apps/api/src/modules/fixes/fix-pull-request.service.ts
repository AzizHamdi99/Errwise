import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { storedFixEditSchema } from '@errwise/shared';
import type {
  FixSuggestion,
  PublicIssueFix,
  StoredFixEdit,
} from '@errwise/shared';
import type { Env } from '../../config/env';
import { AuditService } from '../audit/audit.service';
import { GithubApiClient } from '../github/github-api.client';
import type { GithubPullRequest } from '../github/github-api.client';
import { GithubTokenError } from '../github/github-api.client';
import { GithubReadError, MAX_BLOB_BYTES } from '../github/github-read';
import type { OrgMembership } from '../memberships/memberships.types';
import { GITHUB_PROBLEM, GITHUB_WRITE_REFUSED } from './fix-errors';
import {
  applyEdits,
  denormalizeText,
  introducesPlaceholder,
  isEditablePath,
  normalizeText,
} from './fix-patch';
import {
  buildPullRequestContent,
  linkedGithubIssue,
} from './fix-pull-request-content';
import { toPublicFix } from './fix.mapper';
import { FixesRepository } from './fixes.repository';
import type { FixProject, FixWithIssue } from './fixes.repository';

/** A claim older than this belongs to a request that died. */
const CLAIM_TTL_MS = 120_000;

const editsSchema = z.array(storedFixEditSchema);
const WRITABLE_MODES = new Set(['100644', '100755']);

const CHANGED = () =>
  new ConflictException(
    'The code has changed on the default branch since this fix was made, so it no longer applies. Ask for a new suggestion.',
  );
const NOT_WRITABLE = () =>
  new ConflictException(
    'A file of this fix cannot be changed safely: it is not a regular UTF-8 text file of a size Errwise writes.',
  );

interface FileToWrite {
  path: string;
  mode: string;
  content: string;
}

/**
 * Opens a draft pull request with a stored fix (ADR-009). This is the only place where
 * Errwise writes to a customer's repository, so every step is cautious:
 *
 * - the route is for owners and admins, and the project must still allow it;
 * - the edits come from the database, never from the request, and are applied again to the
 *   default branch as it is now: the code must still match, exactly once;
 * - the branch is named after the fix and never overwritten or moved: if it exists, it is
 *   used only when it holds exactly the tree this call would make;
 * - one request wins the claim, and every step can be repeated safely after a crash.
 */
@Injectable()
export class FixPullRequestService {
  private readonly logger = new Logger(FixPullRequestService.name);
  private readonly webUrl: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly repo: FixesRepository,
    private readonly github: GithubApiClient,
    private readonly audit: AuditService,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true });
  }

  async open(
    membership: OrgMembership,
    projectId: string,
    issueId: string,
    fixId: string,
  ): Promise<PublicIssueFix> {
    const { organizationId, userId } = membership;
    const project = await this.repo.findProject(organizationId, projectId);
    if (!project) throw new NotFoundException('Project not found');
    const found = await this.repo.findFixInProject(
      organizationId,
      projectId,
      issueId,
      fixId,
    );
    if (!found) throw new NotFoundException('Fix not found');

    // Already opened: the same answer, nothing created. A pull request that exists does not
    // depend on today's settings.
    if (found.prNumber !== null && found.prUrl) return toPublicFix(found, true);

    this.requireOpenable(project, found);

    const claimed = await this.repo.claimPullRequest(
      found.id,
      new Date(Date.now() - CLAIM_TTL_MS),
    );
    if (!claimed) {
      // Someone else won the race: their result, if it is already saved.
      const current = await this.repo.findFixInProject(
        organizationId,
        projectId,
        issueId,
        fixId,
      );
      if (current?.prNumber != null && current.prUrl) {
        return toPublicFix(current, true);
      }
      throw new ConflictException(
        'A pull request for this fix is already being opened, or the fix can no longer be used. Try again in a moment.',
      );
    }

    try {
      // Read again after the claim: this is the row that is being turned into a pull request.
      const fix = await this.repo.findFixInProject(
        organizationId,
        projectId,
        issueId,
        fixId,
      );
      if (!fix) throw new NotFoundException('Fix not found');

      const pullRequest = await this.push(
        project,
        fix,
        `${this.webUrl}/organizations/${organizationId}/projects/${projectId}/issues/${issueId}`,
      );
      const { fix: stored, saved } = await this.repo.savePullRequest(fix.id, {
        ...pullRequest,
        userId,
      });
      if (saved) {
        // Names and numbers only: never a title, a path or a line of code.
        await this.audit.record({
          organizationId,
          actorId: userId,
          action: 'fix.pull_request_opened',
          targetType: 'project',
          targetId: projectId,
          projectId,
          metadata: { repo: fix.repo, number: pullRequest.number },
        });
      }
      return toPublicFix(stored, false);
    } catch (error) {
      await this.releaseClaim(found.id);
      throw this.translate(error);
    }
  }

  /** The 409s that can be known from the rows alone, before anything is claimed. */
  private requireOpenable(project: FixProject, fix: FixWithIssue): void {
    if (!project.sourceContextEnabled || !project.fixPullRequestsEnabled) {
      throw new ConflictException(
        'AI fix pull requests are not turned on for this project',
      );
    }
    if (!project.githubInstallationId || !project.githubRepo) {
      throw new ConflictException('GitHub is not connected to this project');
    }
    if (
      project.githubInstallationId !== fix.installationId ||
      project.githubRepo.toLowerCase() !== fix.repo.toLowerCase()
    ) {
      throw new ConflictException(
        'This fix was made for another repository. Ask for a new suggestion.',
      );
    }
    if (fix.edits === null) {
      throw new ConflictException(
        'The code of this fix was removed. Ask for a new suggestion.',
      );
    }
  }

  private async push(
    project: FixProject,
    fix: FixWithIssue,
    issueUrl: string,
  ): Promise<GithubPullRequest> {
    const installationId = fix.installationId;
    const repo = fix.repo;

    const suggestion = this.suggestionOf(fix);
    const edits = suggestion.edits;
    if (!suggestion.fixable || edits.length === 0) {
      throw new ConflictException('This fix has no change to apply');
    }

    // The default branch as it is now: the edits must still apply to it, exactly.
    const head = await this.github.getDefaultBranchHead(installationId, repo);
    const [baseTree, tree] = await Promise.all([
      this.github.getCommitTree(installationId, repo, head.sha),
      this.github.getTree(installationId, repo, head.sha),
    ]);
    const files = await this.rewrite(installationId, repo, tree, edits);

    // Blobs and trees are content-addressed: making them again gives the same hashes, so a
    // repeated request does no harm, and none of it is visible until a branch points at it.
    const entries: { path: string; mode: string; sha: string }[] = [];
    for (const file of files) {
      entries.push({
        path: file.path,
        mode: file.mode,
        sha: await this.github.createBlob(installationId, repo, file.content),
      });
    }
    const treeSha = await this.github.createTree(
      installationId,
      repo,
      baseTree,
      entries,
    );

    const content = buildPullRequestContent({
      suggestion,
      issueUrl,
      githubIssueNumber: linkedGithubIssue(fix.issue, repo),
      files: files.map((f) => f.path),
    });

    const branch = `errwise/fix-${fix.id}`;
    const tip = await this.github.getBranchHead(installationId, repo, branch);
    if (tip) {
      // Left by an earlier attempt. Used only if it is exactly this change; anything else
      // is somebody's work, and is left alone.
      const tipTree = await this.github.getCommitTree(
        installationId,
        repo,
        tip,
      );
      if (tipTree !== treeSha) {
        throw new ConflictException(
          `The branch ${branch} already exists with other content. Delete it on GitHub and try again.`,
        );
      }
    }

    // The last moment to stop: the owner may have turned the feature off meanwhile.
    if (!(await this.repo.isStillOpenable(fix.id))) {
      throw new ConflictException(
        'AI fix pull requests were turned off while this one was being opened',
      );
    }

    let createdHere = false;
    if (!tip) {
      const commit = await this.github.createCommit(installationId, repo, {
        message: content.commitMessage,
        tree: treeSha,
        parent: head.sha,
      });
      const made = await this.github.createBranch(
        installationId,
        repo,
        branch,
        commit,
      );
      if (made === 'exists') {
        throw new ConflictException(
          'The branch for this fix appeared while it was being made. Try again.',
        );
      }
      createdHere = true;
    }

    const existing = await this.github.findPullRequest(
      installationId,
      repo,
      branch,
    );
    if (existing) return existing;

    const outcome = await this.github.createPullRequest(installationId, repo, {
      title: content.title,
      body: content.body,
      head: branch,
      base: head.branch,
    });

    if (outcome.kind === 'created') return outcome.pullRequest;

    if (outcome.kind === 'exists') {
      const raced = await this.github.findPullRequest(
        installationId,
        repo,
        branch,
      );
      if (raced) return raced;
      throw new ConflictException(
        'GitHub says a pull request exists for this branch, but it could not be found. Try again.',
      );
    }

    // Drafts are not available here, and Errwise only opens drafts. Take back the branch this
    // call made, so nothing is left behind.
    if (createdHere)
      await this.deleteBranchQuietly(installationId, repo, branch);
    throw new ConflictException(
      'GitHub does not offer draft pull requests for this repository, and Errwise only opens drafts. Nothing was changed.',
    );
  }

  /**
   * The edits applied to the default branch's version of each file, as the exact text to write
   * back. Anything unexpected is a refusal for the whole fix.
   */
  private async rewrite(
    installationId: string,
    repo: string,
    tree: Awaited<ReturnType<GithubApiClient['getTree']>>,
    edits: StoredFixEdit[],
  ): Promise<FileToWrite[]> {
    const byFile = new Map<string, StoredFixEdit[]>();
    for (const edit of edits) {
      byFile.set(edit.file, [...(byFile.get(edit.file) ?? []), edit]);
    }

    const written: FileToWrite[] = [];
    for (const [path, fileEdits] of byFile) {
      // Checked again: the stored row is old code's idea of what is editable.
      if (!isEditablePath(path)) throw NOT_WRITABLE();

      const entry = tree.files.get(path);
      if (!entry) throw CHANGED(); // moved, deleted, or past a truncated tree
      if (!WRITABLE_MODES.has(entry.mode ?? '')) throw NOT_WRITABLE(); // symlink, submodule
      if (entry.size > MAX_BLOB_BYTES) throw NOT_WRITABLE();

      const blob = await this.github.getBlobExact(
        installationId,
        repo,
        entry.sha,
      );
      if (blob.kind !== 'text') throw NOT_WRITABLE();
      const current = normalizeText(blob.text);
      if (!current.ok) throw NOT_WRITABLE();

      if (
        fileEdits.some((e) =>
          introducesPlaceholder(e.replace, current.value.text),
        )
      ) {
        throw NOT_WRITABLE();
      }
      const applied = applyEdits(current.value.text, fileEdits);
      if (!applied.ok) throw CHANGED();

      const content = denormalizeText(current.value, applied.text);
      if (content === blob.text) throw CHANGED(); // nothing left to change: already fixed
      if (Buffer.byteLength(content, 'utf8') > MAX_BLOB_BYTES) {
        throw NOT_WRITABLE();
      }
      written.push({ path, mode: entry.mode as string, content });
    }
    return written;
  }

  private suggestionOf(fix: FixWithIssue): FixSuggestion {
    const edits = editsSchema.safeParse(fix.edits);
    const result = toPublicFix(fix, true).suggestion;
    if (!edits.success || !result) {
      throw new ConflictException(
        'The code of this fix was removed. Ask for a new suggestion.',
      );
    }
    return { ...result, edits: edits.data };
  }

  /** Never hides the real error: a failed release is only logged. */
  private async releaseClaim(fixId: string): Promise<void> {
    try {
      await this.repo.releasePullRequestClaim(fixId);
    } catch {
      this.logger.warn('Could not release the claim of a fix');
    }
  }

  private async deleteBranchQuietly(
    installationId: string,
    repo: string,
    branch: string,
  ): Promise<void> {
    try {
      await this.github.deleteBranch(installationId, repo, branch);
    } catch {
      this.logger.warn('Could not delete the branch of a fix');
    }
  }

  private translate(error: unknown): unknown {
    if (error instanceof GithubTokenError) return GITHUB_WRITE_REFUSED();
    if (error instanceof GithubReadError) return GITHUB_PROBLEM[error.kind]();
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'This pull request is already recorded for another fix',
      );
    }
    return error;
  }
}
