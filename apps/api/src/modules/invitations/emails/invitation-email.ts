import { escapeHtml } from '../../../common/utils/html';
import type { MailMessage } from '../../mail/mail.service';

import { COLORS, FONT } from '../../mail/email-theme';
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
  const role = params.role.charAt(0).toUpperCase() + params.role.slice(1);
  // keep line breaks out of the subject
  const subject = `${inviter} invited you to ${org} on Errwise`.replace(
    /[\r\n]+/g,
    ' ',
  );

  const text =
    `${inviter} invited you to join "${org}" on Errwise as ${params.role}.\n\n` +
    `Accept the invitation (valid for ${params.ttlDays} days):\n${params.url}\n\n` +
    `If you don't know ${inviter}, you can ignore this email.`;

  const e = {
    inviter: escapeHtml(inviter),
    org: escapeHtml(org),
    role: escapeHtml(role),
    url: escapeHtml(params.url),
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark light" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.pageBg};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${e.inviter} invited you to join ${e.org} on Errwise.
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLORS.pageBg}" style="background:${COLORS.pageBg};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
          <tr>
            <td style="padding:0 0 24px 4px;font-family:${FONT};font-size:20px;font-weight:700;letter-spacing:-0.02em;color:${COLORS.text};">
              <span style="color:${COLORS.accent};">&#9679;</span>&nbsp;Errwise
            </td>
          </tr>
          <tr>
            <td bgcolor="${COLORS.cardBg}" style="background:${COLORS.cardBg};border:1px solid ${COLORS.border};border-radius:16px;padding:36px 32px;font-family:${FONT};">
              <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.muted};">
                Workspace invitation
              </p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:600;color:${COLORS.text};">
                Join ${e.org} on Errwise
              </h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${COLORS.muted};">
                <strong style="color:${COLORS.text};">${e.inviter}</strong> invited you to collaborate
                on error monitoring in <strong style="color:${COLORS.text};">${e.org}</strong>.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;border:1px solid ${COLORS.border};border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;font-size:13px;color:${COLORS.muted};">Your role</td>
                  <td align="right" style="padding:14px 16px;font-size:13px;font-weight:600;color:${COLORS.text};">${e.role}</td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td align="center" bgcolor="${COLORS.accent}" style="border-radius:10px;">
                    <a href="${e.url}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:${COLORS.accentText};text-decoration:none;border-radius:10px;">
                      Accept invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${COLORS.muted};">
                This invitation is valid for ${params.ttlDays} days. If the button doesn't work, copy this link:
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;">
                <a href="${e.url}" style="color:${COLORS.accent};text-decoration:underline;">${e.url}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLORS.muted};text-align:center;">
              If you don't know ${e.inviter}, you can safely ignore this email.<br />
              &copy; ${new Date().getFullYear()} Errwise
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { to: params.to, subject, text, html };
}
