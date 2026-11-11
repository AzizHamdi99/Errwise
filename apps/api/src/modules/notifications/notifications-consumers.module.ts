import { Module } from '@nestjs/common';
import { NewIssueEmailConsumer } from './new-issue-email.consumer';
import { NotificationsModule } from './notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [NewIssueEmailConsumer],
})
export class NotificationsConsumersModule {}
