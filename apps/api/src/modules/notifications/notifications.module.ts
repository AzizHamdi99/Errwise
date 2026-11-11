import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { MailModule } from '../mail/mail.module';
import { MessagePublisher } from '../messaging/message-publisher';
import { MessagingModule } from '../messaging/messaging.module';
import { DirectIssueAlertDispatcher } from './direct-issue-alert-dispatcher';
import { IssueAlertDispatcher } from './issue-alert-dispatcher';
import { NewIssueNotifier } from './new-issue-notifier';
import { NotificationsRepository } from './notifications.repository';
import { QueueIssueAlertDispatcher } from './queue-issue-alert-dispatcher';

@Module({
  imports: [MailModule, MessagingModule],
  providers: [
    NotificationsRepository,
    NewIssueNotifier,
    {
      provide: IssueAlertDispatcher,
      inject: [ConfigService, NewIssueNotifier, MessagePublisher],
      useFactory: (
        config: ConfigService<Env, true>,
        notifier: NewIssueNotifier,
        publisher: MessagePublisher,
      ): IssueAlertDispatcher =>
        config.get('ALERT_DELIVERY', { infer: true }) === 'direct'
          ? new DirectIssueAlertDispatcher(notifier)
          : new QueueIssueAlertDispatcher(publisher),
    },
  ],
  exports: [IssueAlertDispatcher, NewIssueNotifier],
})
export class NotificationsModule {}
