import { Injectable } from '@nestjs/common';
import { GithubRegressionSync } from '../github/github-regression-sync';
import { RegressionNotifier } from './regression-notifier';

/** Everything that happens when a resolved issue comes back: the email and the GitHub sync. */
@Injectable()
export class RegressionHandler {
  constructor(
    private readonly email: RegressionNotifier,
    private readonly github: GithubRegressionSync,
  ) {}

  /** Throws only when the email failed, so the queue retries it. The GitHub sync never throws. */
  async handle(issueId: string, environment: string): Promise<void> {
    const [email] = await Promise.allSettled([
      this.email.notify(issueId, environment),
      this.github.sync(issueId, environment),
    ]);
    if (email.status === 'rejected') throw email.reason as Error;
  }
}
