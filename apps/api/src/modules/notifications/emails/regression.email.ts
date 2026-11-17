import type { MailMessage } from '../../mail/mail.service';
import { renderIssueAlertHtml } from './issue-alert.layout';

export function regressionEmail(params: {
  to: string;
  projectName: string;
  title: string;
  environment: string;
  release: string | null;
  regressedAt: Date;
  regressionCount: number;
  url: string;
}): MailMessage {
  // keep line breaks out of the subject (the title comes from user code)
  const subject =
    `[Errwise] Regression in ${params.projectName} (${params.environment}): ${params.title}`
      .replace(/[\r\n]+/g, ' ')
      .slice(0, 200);

  const text =
    `A resolved issue happened again in ${params.projectName} (${params.environment})\n\n` +
    `${params.title}\n\n` +
    `Release: ${params.release ?? 'unknown'}\n` +
    `Happened again: ${params.regressedAt.toUTCString()}\n` +
    `Times reopened: ${params.regressionCount}\n\n` +
    `View it: ${params.url}\n\n` +
    `You get this email because you follow ${params.projectName}. ` +
    `Turn it off with the notification button on the project page.`;

  const html = renderIssueAlertHtml({
    subject,
    eyebrow: `Regression in ${params.projectName}`,
    title: params.title,
    rows: [
      { label: 'Environment', value: params.environment },
      { label: 'Release', value: params.release ?? 'unknown' },
      { label: 'Happened again', value: params.regressedAt.toUTCString() },
      { label: 'Times reopened', value: String(params.regressionCount) },
    ],
    ctaLabel: 'View issue',
    url: params.url,
    projectName: params.projectName,
  });

  return { to: params.to, subject, text, html };
}
