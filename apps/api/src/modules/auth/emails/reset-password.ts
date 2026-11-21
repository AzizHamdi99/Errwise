import { escapeHtml } from '../../../common/utils/html';
import { COLORS, FONT } from '../../mail/email-theme';
import type { MailMessage } from '../../mail/mail.service';

export function resetPasswordEmail(params: {
  to: string;
  /** What the person typed when they registered: untrusted, so it is escaped. */
  name: string | null;
  /** Built by the backend from WEB_URL and the token, never from user input. */
  url: string;
  ttlMinutes: number;
}): MailMessage {
  const subject = 'Reset your Errwise password';
  const greeting = params.name ? `Hi ${params.name},` : 'Hi,';

  const text =
    `${greeting}\n\n` +
    `Someone asked to reset the password of your Errwise account. Choose a new password ` +
    `with this link (valid for ${params.ttlMinutes} minutes, and only once):\n${params.url}\n\n` +
    `Setting a new password signs you out of every device.\n\n` +
    `If you did not ask for this, ignore this email: your password stays the same.`;

  const e = {
    greeting: escapeHtml(greeting),
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
    Choose a new password for your Errwise account.
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
                Password reset
              </p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;font-weight:600;color:${COLORS.text};">
                Choose a new password
              </h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${COLORS.muted};">
                ${e.greeting} someone asked to reset the password of your Errwise account. Setting a new password signs you out of every device.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
                <tr>
                  <td align="center" bgcolor="${COLORS.accent}" style="border-radius:10px;">
                    <a href="${e.url}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:${COLORS.accentText};text-decoration:none;border-radius:10px;">
                      Reset password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:${COLORS.muted};">
                This link works once and for ${params.ttlMinutes} minutes. If the button doesn't work, copy this link:
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;word-break:break-all;">
                <a href="${e.url}" style="color:${COLORS.accent};text-decoration:underline;">${e.url}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLORS.muted};text-align:center;">
              If you did not ask for this, ignore this email: your password stays the same.<br />
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
