import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MembershipsModule } from '../memberships/memberships.module';
import { GithubApiClient } from './github-api.client';
import { GithubInstallationController } from './github-installation.controller';
import { GithubIntegrationService } from './github-integration.service';
import { GithubStateService } from './github-state.service';
import { GithubController } from './github.controller';
import { GithubRepository } from './github.repository';
import { GithubIssuesController } from './github-issues.controller';
import { GithubIssueService } from './github-issue.service';

@Module({
  // No default secret: each call passes its own key (app key or state secret).
  imports: [MembershipsModule, JwtModule.register({})],
  controllers: [
    GithubController,
    GithubInstallationController,
    GithubIssuesController,
  ],
  providers: [
    GithubApiClient,
    GithubStateService,
    GithubRepository,
    GithubIntegrationService,
    GithubIssueService,
  ],
  // Step 4 (creating the GitHub issue) will reuse these.
  exports: [GithubApiClient, GithubRepository],
})
export class GithubModule {}
