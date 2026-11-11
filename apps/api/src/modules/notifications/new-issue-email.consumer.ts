import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISSUE_CREATED, QUEUES } from '@errwise/shared';
import type { Message } from '@errwise/shared';
import type { Env } from '../../config/env';
import { QueueConsumer } from '../messaging/queue-consumer';
import { NewIssueNotifier } from './new-issue-notifier';

@Injectable()
export class NewIssueEmailConsumer extends QueueConsumer {
  protected readonly queue = QUEUES.notificationsEmail.name;

  constructor(
    config: ConfigService<Env, true>,
    private readonly notifier: NewIssueNotifier,
  ) {
    super(config);
  }

  protected async handle(message: Message): Promise<void> {
    if (message.type !== ISSUE_CREATED) return;
    await this.notifier.notify(message.data.issueId, message.data.environment);
  }
}
