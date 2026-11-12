import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { completeGithubInstallationSchema } from '@errwise/shared';
import type {
  CompleteGithubInstallationInput,
  GithubInstallResult,
} from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import type { AuthUser } from '../../common/types/auth-user';
import { GithubIntegrationService } from './github-integration.service';

@Controller('integrations/github')
@UseGuards(JwtAuthGuard)
export class GithubInstallationController {
  constructor(private readonly integration: GithubIntegrationService) {}

  /** Called by the web callback page after GitHub redirects the owner back. */
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  complete(
    @Body(new ZodValidationPipe(completeGithubInstallationSchema))
    body: CompleteGithubInstallationInput,
    @Req() req: Request & { user: AuthUser },
  ): Promise<GithubInstallResult> {
    return this.integration.completeInstallation(req.user.id, body);
  }
}
