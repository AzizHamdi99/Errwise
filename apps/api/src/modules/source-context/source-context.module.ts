import { Module } from '@nestjs/common';
import { GithubModule } from '../github/github.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { SourceContextController } from './source-context.controller';
import { SourceContextRepository } from './source-context.repository';
import { SourceContextService } from './source-context.service';

@Module({
  imports: [MembershipsModule, GithubModule],
  controllers: [SourceContextController],
  providers: [SourceContextService, SourceContextRepository],
})
export class SourceContextModule {}
