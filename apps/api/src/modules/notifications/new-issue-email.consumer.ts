// import { Injectable } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { ISSUE_CREATED, QUEUES } from '@errwise/shared';
// import type { Message } from '@errwise/shared';
// import type { Env } from '../../config/env';
// import { QueueConsumer } from '../messaging/queue-consumer';
// import { NewIssueNotifier } from './new-issue-notifier';

// @Injectable()
// export class NewIssueEmailConsumer extends QueueConsumer {
//   protected readonly queue = QUEUES.notificationsEmail.name;

//   constructor(
//     config: ConfigService<Env, true>,
//     private readonly notifier: NewIssueNotifier,
//   ) {
//     super(config);
//   }

//   protected async handle(message: Message): Promise<void> {
//     if (message.type !== ISSUE_CREATED) return;
//     await this.notifier.notify(message.data.issueId, message.data.environment);
//   }
// }

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISSUE_CREATED, ISSUE_REGRESSED, QUEUES } from '@errwise/shared';
import type { Message } from '@errwise/shared';
import type { Env } from '../../config/env';
import { QueueConsumer } from '../messaging/queue-consumer';
import { NewIssueNotifier } from './new-issue-notifier';
import { RegressionNotifier } from './regression-notifier';

/** Consumes every message of the notifications.email queue. */
@Injectable()
export class NewIssueEmailConsumer extends QueueConsumer {
  protected readonly queue = QUEUES.notificationsEmail.name;

  constructor(
    config: ConfigService<Env, true>,
    private readonly newIssues: NewIssueNotifier,
    private readonly regressions: RegressionNotifier,
  ) {
    super(config);
  }

  protected handle(message: Message): Promise<void> {
    switch (message.type) {
      case ISSUE_CREATED:
        return this.newIssues.notify(
          message.data.issueId,
          message.data.environment,
        );
      case ISSUE_REGRESSED:
        return this.regressions.notify(
          message.data.issueId,
          message.data.environment,
        );
    }
  }
}
