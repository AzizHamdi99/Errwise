import { escapeHtml } from '../../../common/utils/html';
import type { MailMessage } from '../../mail/mail.service';

export function invitationEmail(params: {
  to: string;
  organizationName: string;
  inviterName: string | null;
  role: string;
  url: string;
  ttlDays: number;
}): MailMessage {
  const inviter = params.inviterName ?? 'Someone';
  const org = params.organizationName;
  // keep line breaks out of the subject
  const subject = `${inviter} invited you to ${org} on Errwise`.replace(
    /[\r\n]+/g,
    ' ',
  );

  const text =
    `${inviter} invited you to join "${org}" on Errwise as ${params.role}.\n\n` +
    `Accept the invitation (valid for ${params.ttlDays} days):\n${params.url}\n\n` +
    `If you don't know ${inviter}, you can ignore this email.`;

  const html =
    `<p><strong>${escapeHtml(inviter)}</strong> invited you to join ` +
    `<strong>${escapeHtml(org)}</strong> on Errwise as ${escapeHtml(params.role)}.</p>` +
    `<p><a href="${escapeHtml(params.url)}">Accept the invitation</a> ` +
    `(valid for ${params.ttlDays} days)</p>` +
    `<p>If you don't know ${escapeHtml(inviter)}, you can ignore this email.</p>`;

  return { to: params.to, subject, text, html };
}
