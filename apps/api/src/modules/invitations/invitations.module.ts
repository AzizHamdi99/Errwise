import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { UsersModule } from '../users/users.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsRepository } from './invitations.repository';
import { InvitationsService } from './invitations.service';
import { OrgInvitationsController } from './org-invitations.controller';

@Module({
  imports: [MailModule, MembershipsModule, UsersModule],
  controllers: [OrgInvitationsController, InvitationsController],
  providers: [InvitationsService, InvitationsRepository],
})
export class InvitationsModule {}
