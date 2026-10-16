import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { createApiKeySchema, idSchema } from '@errwise/shared';
import type {
  CreateApiKeyInput,
  CreatedApiKey,
  PublicApiKey,
} from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgRoles } from '../memberships/decorators/org-roles.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { ApiKeysService } from './api-keys.service';

@Controller('organizations/:orgId/projects/:projectId/api-keys')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class ApiKeysController {
  constructor(private readonly apiKeys: ApiKeysService) {}

  @Post()
  @OrgRoles('owner')
  @Header('Cache-Control', 'no-store')
  create(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Body(new ZodValidationPipe(createApiKeySchema)) body: CreateApiKeyInput,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<CreatedApiKey> {
    return this.apiKeys.create(membership.organizationId, projectId, body);
  }

  @Get()
  list(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<PublicApiKey[]> {
    return this.apiKeys.list(membership.organizationId, projectId);
  }

  @Delete(':keyId')
  @OrgRoles('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(
    @Param('projectId', new ZodValidationPipe(idSchema)) projectId: string,
    @Param('keyId', new ZodValidationPipe(idSchema)) keyId: string,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<void> {
    return this.apiKeys.revoke(membership.organizationId, projectId, keyId);
  }
}
