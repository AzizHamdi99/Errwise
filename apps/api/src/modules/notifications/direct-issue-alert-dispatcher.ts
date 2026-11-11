import { Logger } from '@nestjs/common';
import {
  IssueAlertDispatcher,
  type NewIssueAlert,
} from './issue-alert-dispatcher';
import type { NewIssueNotifier } from './new-issue-notifier';

// A serverless function has a time limit: stop sending when the budget is used.
const TIME_BUDGET_MS = 8_000;

/** Sends the emails right away, inside the request. No queue, no worker. */
export class DirectIssueAlertDispatcher extends IssueAlertDispatcher {
  private readonly logger = new Logger(DirectIssueAlertDispatcher.name);

  constructor(private readonly notifier: NewIssueNotifier) {
    super();
  }

  async dispatch(alerts: NewIssueAlert[]): Promise<void> {
    const deadline = Date.now() + TIME_BUDGET_MS;

    for (const [index, alert] of alerts.entries()) {
      if (Date.now() >= deadline) {
        this.logger.warn(
          `Time budget used, ${alerts.length - index} alert(s) not sent`,
        );
        return;
      }
      try {
        await this.notifier.notify(alert.issueId, alert.environment);
      } catch (error) {
        this.logger.error(
          `Alert for issue ${alert.issueId} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}
