import { escapeHtml } from '../../../common/utils/html';
import { COLORS, FONT } from '../../mail/email-theme';
import type { MailMessage } from '../../mail/mail.service';

export function newIssueEmail(params: {
  to: string;
  projectName: string;
  title: string;
  environment: string;
  release: string | null;
  firstSeenAt: Date;
  url: string;
}): MailMessage {
  // keep line breaks out of the subject (the title comes from user code)
  const subject =
    `[Errwise] New issue in ${params.projectName} (${params.environment}): ${params.title}`
      .replace(/[\r\n]+/g, ' ')
      .slice(0, 200);

  const text =
    `New issue in ${params.projectName} (${params.environment})\n\n` +
    `${params.title}\n\n` +
    `Release: ${params.release ?? 'unknown'}\n` +
    `First seen: ${params.firstSeenAt.toUTCString()}\n\n` +
    `View it: ${params.url}\n\n` +
    `You get this email because you follow ${params.projectName}. ` +
    `Turn it off with the notification button on the project page.`;

  const e = {
    project: escapeHtml(params.projectName),
    title: escapeHtml(params.title),
    environment: escapeHtml(params.environment),
    release: escapeHtml(params.release ?? 'unknown'),
    firstSeen: escapeHtml(params.firstSeenAt.toUTCString()),
    url: escapeHtml(params.url),
  };

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:10px 16px;font-size:13px;color:${COLORS.muted};">${label}</td>
      <td align="right" style="padding:10px 16px;font-size:13px;font-weight:600;color:${COLORS.text};">${value}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark light" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.pageBg};">
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
                New issue in ${e.project}
              </p>
              <h1 style="margin:0 0 24px;font-size:20px;line-height:1.4;font-weight:600;color:${COLORS.text};word-break:break-word;">
                ${e.title}
              </h1>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;border:1px solid ${COLORS.border};border-radius:12px;">
                ${row('Environment', e.environment)}
                ${row('Release', e.release)}
                ${row('First seen', e.firstSeen)}
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${COLORS.accent}" style="border-radius:10px;">
                    <a href="${e.url}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:${COLORS.accentText};text-decoration:none;border-radius:10px;">
                      View issue
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLORS.muted};text-align:center;">
              You get this email because you follow ${e.project}.<br />
              Turn it off with the notification button on the project page.
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
