import { Module } from '@nestjs/common';
import { OrgMemberGuard } from './guards/org-member.guard';
import { MembershipsController } from './memberships.controller';
import { MembershipsRepository } from './memberships.repository';
import { MembershipsService } from './memberships.service';

@Module({
  controllers: [MembershipsController],
  providers: [MembershipsService, MembershipsRepository, OrgMemberGuard],
  exports: [MembershipsService, OrgMemberGuard],
})
export class MembershipsModule {}
