import { Global, Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { AuditController } from './audit.controller';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';

/**
 * Global, like PrismaModule: six modules record entries, memberships among them, and this
 * module needs memberships' guard for its own route. Importing it everywhere would make
 * memberships and audit import each other.
 */
@Global()
@Module({
  imports: [MembershipsModule],
  controllers: [AuditController],
  providers: [AuditService, AuditRepository],
  exports: [AuditService],
})
export class AuditModule {}
