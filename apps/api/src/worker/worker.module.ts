import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '../config/env';
import { PrismaModule } from '../database/prisma.module';
import { NotificationsConsumersModule } from 'src/modules/notifications/notifications-consumers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    NotificationsConsumersModule,
  ],
})
export class WorkerModule {}
