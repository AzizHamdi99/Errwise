import { ISSUE_CREATED } from '@errwise/shared';
import {
  MessagePublisher,
  type OutgoingMessage,
} from '../messaging/message-publisher';
import {
  IssueAlertDispatcher,
  type NewIssueAlert,
} from './issue-alert-dispatcher';

/** Publishes to RabbitMQ. The worker sends the emails. */
export class QueueIssueAlertDispatcher extends IssueAlertDispatcher {
  constructor(private readonly publisher: MessagePublisher) {
    super();
  }

  dispatch(alerts: NewIssueAlert[]): Promise<void> {
    return this.publisher.publish(
      alerts.map((alert): OutgoingMessage => ({
        type: ISSUE_CREATED,
        data: alert,
      })),
    );
  }
}
