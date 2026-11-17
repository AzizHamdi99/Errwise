// import { ISSUE_CREATED } from '@errwise/shared';
// import {
//   MessagePublisher,
//   type OutgoingMessage,
// } from '../messaging/message-publisher';
// import {
//   IssueAlertDispatcher,
//   type NewIssueAlert,
// } from './issue-alert-dispatcher';

// /** Publishes to RabbitMQ. The worker sends the emails. */
// export class QueueIssueAlertDispatcher extends IssueAlertDispatcher {
//   constructor(private readonly publisher: MessagePublisher) {
//     super();
//   }

//   dispatch(alerts: NewIssueAlert[]): Promise<void> {
//     return this.publisher.publish(
//       alerts.map((alert): OutgoingMessage => ({
//         type: ISSUE_CREATED,
//         data: alert,
//       })),
//     );
//   }
// }

import { ISSUE_CREATED, ISSUE_REGRESSED } from '@errwise/shared';
import {
  MessagePublisher,
  type OutgoingMessage,
} from '../messaging/message-publisher';
import {
  IssueAlertDispatcher,
  type IssueAlerts,
} from './issue-alert-dispatcher';

/** Publishes to RabbitMQ. The worker sends the emails. */
export class QueueIssueAlertDispatcher extends IssueAlertDispatcher {
  constructor(private readonly publisher: MessagePublisher) {
    super();
  }

  dispatch({ created, regressed }: IssueAlerts): Promise<void> {
    return this.publisher.publish([
      ...created.map((data): OutgoingMessage => ({
        type: ISSUE_CREATED,
        data,
      })),
      ...regressed.map((data): OutgoingMessage => ({
        type: ISSUE_REGRESSED,
        data,
      })),
    ]);
  }
}
