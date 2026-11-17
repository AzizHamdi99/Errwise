import { escapeHtml } from '../../../common/utils/html';
import { COLORS, FONT } from '../../mail/email-theme';

export interface AlertRow {
  label: string;
  value: string;
}

/** Shared layout for issue alerts. Callers pass raw values: they are escaped here. */
export function renderIssueAlertHtml(p: {
  subject: string;
  eyebrow: string;
  title: string;
  rows: AlertRow[];
  ctaLabel: string;
  url: string;
  projectName: string;
}): string {
  const e = {
    subject: escapeHtml(p.subject),
    eyebrow: escapeHtml(p.eyebrow),
    title: escapeHtml(p.title),
    cta: escapeHtml(p.ctaLabel),
    url: escapeHtml(p.url),
    project: escapeHtml(p.projectName),
  };

  const rows = p.rows
    .map(
      (r) => `<tr>
      <td style="padding:10px 16px;font-size:13px;color:${COLORS.muted};">${escapeHtml(r.label)}</td>
      <td align="right" style="padding:10px 16px;font-size:13px;font-weight:600;color:${COLORS.text};">${escapeHtml(r.value)}</td>
    </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark light" />
  <title>${e.subject}</title>
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
                ${e.eyebrow}
              </p>
              <h1 style="margin:0 0 24px;font-size:20px;line-height:1.4;font-weight:600;color:${COLORS.text};word-break:break-word;">
                ${e.title}
              </h1>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;border:1px solid ${COLORS.border};border-radius:12px;">
                ${rows}
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${COLORS.accent}" style="border-radius:10px;">
                    <a href="${e.url}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:${COLORS.accentText};text-decoration:none;border-radius:10px;">
                      ${e.cta}
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
}
