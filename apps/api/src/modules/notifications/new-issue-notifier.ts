import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { MailService } from '../mail/mail.service';
import { newIssueEmail } from './emails/new-issue.email';
import { NotificationsRepository } from './notifications.repository';

@Injectable()
export class NewIssueNotifier {
  private readonly logger = new Logger(NewIssueNotifier.name);
  private readonly webUrl: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly repo: NotificationsRepository,
    private readonly mail: MailService,
  ) {
    this.webUrl = config.get('WEB_URL', { infer: true });
  }

  /** Emails the project's subscribed members about a new issue. Throws if no email could be sent. */
  async notify(issueId: string, environment: string): Promise<void> {
    const issue = await this.repo.findIssueContext(issueId);
    if (
      !issue ||
      issue.project.deletedAt ||
      issue.project.organization.deletedAt
    ) {
      this.logger.warn(`Issue ${issueId} no longer exists, skipping`);
      return;
    }
    // A queue redelivery or a retry must not send a second email.
    if (issue.lastNotifiedAt) return;

    const recipients = await this.repo.findRecipients(
      issue.projectId,
      issue.project.organizationId,
    );
    if (recipients.length === 0) return;

    const url = `${this.webUrl}/organizations/${issue.project.organizationId}/projects/${issue.projectId}/issues/${issue.id}`;
    const results = await Promise.allSettled(
      recipients.map((recipient) =>
        this.mail.send(
          newIssueEmail({
            to: recipient.email,
            projectName: issue.project.name,
            title: issue.title,
            environment,
            release: issue.firstRelease,
            firstSeenAt: issue.firstSeenAt,
            url,
          }),
        ),
      ),
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    if (sent === 0) {
      const failure = results.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      const reason =
        failure?.reason instanceof Error ? failure.reason.message : 'unknown';
      throw new Error(`No email could be sent: ${reason}`);
    }
    if (sent < recipients.length) {
      // Some succeeded: do not retry, or the others would get duplicates.
      this.logger.warn(
        `Sent ${sent}/${recipients.length} emails for issue ${issueId}`,
      );
    }
    await this.repo.markNotified(issue.id);
  }
}
