import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProjectsModule } from '../projects/projects.module';
import { ApiKeyAuthService } from './api-key-auth.service';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysRepository } from './api-keys.repository';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
  imports: [MembershipsModule, ProjectsModule],
  controllers: [ApiKeysController],
  providers: [
    ApiKeysService,
    ApiKeyAuthService,
    ApiKeysRepository,
    ApiKeyGuard,
  ],
  exports: [ApiKeyAuthService, ApiKeyGuard],
})
export class ApiKeysModule {}
