import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CompleteGithubInstallationInput,
  GithubConnection,
  GithubInstallResult,
  GithubInstallUrl,
  GithubRepo,
} from '@errwise/shared';
import type { Env } from '../../config/env';
import { MembershipsService } from '../memberships/memberships.service';
import type { OrgMembership } from '../memberships/memberships.types';
import { GithubApiClient } from './github-api.client';
import { GithubStateService } from './github-state.service';
import { GithubRepository, type GithubProjectLink } from './github.repository';

@Injectable()
export class GithubIntegrationService {
  private readonly appSlug: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly repo: GithubRepository,
    private readonly github: GithubApiClient,
    private readonly states: GithubStateService,
    private readonly memberships: MembershipsService,
  ) {
    this.appSlug = config.get('GITHUB_APP_SLUG', { infer: true });
  }

  /** Read-only status, visible to every member. */
  async getConnection(
    organizationId: string,
    projectId: string,
  ): Promise<GithubConnection> {
    const project = await this.requireProject(organizationId, projectId);
    return this.toConnection(project);
  }

  /** Step 1 of the connection: the owner is sent to GitHub with a signed state. */
  async createInstallUrl(
    membership: OrgMembership,
    projectId: string,
  ): Promise<GithubInstallUrl> {
    await this.requireProject(membership.organizationId, projectId);
    const state = await this.states.sign({
      projectId,
      organizationId: membership.organizationId,
      userId: membership.userId,
    });
    return {
      url: `https://github.com/apps/${this.appSlug}/installations/new?state=${encodeURIComponent(state)}`,
    };
  }

  /** Step 2: GitHub sent the owner back. Every check here blocks a forged request. */
  async completeInstallation(
    userId: string,
    input: CompleteGithubInstallationInput,
  ): Promise<GithubInstallResult> {
    const state = await this.states.verify(input.state);

    // The person finishing the flow must be the one who started it.
    if (state.userId !== userId) {
      throw new ForbiddenException(
        'This connection was started by another user',
      );
    }

    // The owner role is re-checked now, not trusted from when the flow started.
    const membership = await this.memberships.findActive(
      userId,
      state.organizationId,
    );
    if (!membership || membership.role !== 'owner') {
      throw new ForbiddenException(
        'Only the organization owner can connect GitHub',
      );
    }

    await this.requireProject(state.organizationId, state.projectId);

    // GitHub confirms this user really has access to this installation id.
    const userToken = await this.github.exchangeUserCode(input.code);
    const allowed = await this.github.userCanAccessInstallation(
      userToken,
      input.installationId,
    );
    if (!allowed) {
      throw new ForbiddenException(
        'You do not have access to this installation',
      );
    }

    await this.repo.saveInstallation(state.projectId, input.installationId);
    return {
      organizationId: state.organizationId,
      projectId: state.projectId,
    };
  }

  async listRepositories(
    organizationId: string,
    projectId: string,
  ): Promise<GithubRepo[]> {
    const project = await this.requireProject(organizationId, projectId);
    return this.github.listRepositories(this.requireInstallationId(project));
  }

  async selectRepository(
    organizationId: string,
    projectId: string,
    repoFullName: string,
  ): Promise<GithubConnection> {
    const project = await this.requireProject(organizationId, projectId);
    const repos = await this.github.listRepositories(
      this.requireInstallationId(project),
    );

    // Only repos the installation can really access may be chosen.
    const match = repos.find(
      (r) => r.fullName.toLowerCase() === repoFullName.toLowerCase(),
    );
    if (!match) {
      throw new BadRequestException(
        'This repository is not available in the GitHub installation',
      );
    }

    await this.repo.saveRepo(projectId, match.fullName);
    return { installed: true, repo: match.fullName };
  }

  /** Unlinks the project. Existing GitHub issue links on Errwise issues are kept. */
  async disconnect(organizationId: string, projectId: string): Promise<void> {
    await this.requireProject(organizationId, projectId);
    await this.repo.disconnect(projectId);
  }

  private async requireProject(
    organizationId: string,
    projectId: string,
  ): Promise<GithubProjectLink> {
    const project = await this.repo.findProject(organizationId, projectId);
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private requireInstallationId(project: GithubProjectLink): string {
    if (!project.githubInstallationId) {
      throw new BadRequestException('GitHub is not connected to this project');
    }
    return project.githubInstallationId;
  }

  private toConnection(project: GithubProjectLink): GithubConnection {
    return {
      installed: project.githubInstallationId !== null,
      repo: project.githubRepo,
    };
  }
}
