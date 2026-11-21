import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { auditLogQuerySchema } from '@errwise/shared';
import type {
  AuditLogQuery,
  Paginated,
  PublicAuditEntry,
} from '@errwise/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { CurrentMembership } from '../memberships/decorators/current-membership.decorator';
import { OrgRoles } from '../memberships/decorators/org-roles.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import type { OrgMembership } from '../memberships/memberships.types';
import { AuditService } from './audit.service';

/**
 * Read only: there is no route to change or delete an entry. Owners and admins only, because
 * the log names members and what they did. Another organization answers 404 (OrgMemberGuard).
 */
@Controller('organizations/:orgId/audit-log')
@UseGuards(JwtAuthGuard, OrgMemberGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @OrgRoles('owner', 'admin')
  list(
    @Query(new ZodValidationPipe(auditLogQuerySchema)) query: AuditLogQuery,
    @CurrentMembership() membership: OrgMembership,
  ): Promise<Paginated<PublicAuditEntry>> {
    return this.audit.list(membership.organizationId, query);
  }
}
