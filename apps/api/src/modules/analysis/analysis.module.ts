import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { ProjectsModule } from '../projects/projects.module';
import { SourceContextModule } from '../source-context/source-context.module';
import { AiClient } from './ai.client';
import { AnalysisController } from './analysis.controller';
import { AnalysisRepository } from './analysis.repository';
import { AnalysisService } from './analysis.service';

@Module({
  imports: [MembershipsModule, ProjectsModule, SourceContextModule],
  controllers: [AnalysisController],
  providers: [AnalysisService, AnalysisRepository, AiClient],
})
export class AnalysisModule {}
