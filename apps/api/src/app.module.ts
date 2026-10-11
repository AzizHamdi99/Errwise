import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { IssuesModule } from './modules/issues/issues.module';
import { EventsModule } from './modules/events/events.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { MembershipsModule } from './modules/memberships/memberships.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [AuthModule, UsersModule, OrganizationsModule, MembershipsModule, ProjectsModule, ApiKeysModule, EventsModule, IssuesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
