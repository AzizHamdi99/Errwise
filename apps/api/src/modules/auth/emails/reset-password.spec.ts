import { resetPasswordEmail } from './reset-password';

const URL = 'https://app.test/reset-password?token=abc_DEF-123';

const base = { to: 'ada@example.com', name: 'Ada', url: URL, ttlMinutes: 60 };

describe('resetPasswordEmail', () => {
  it('has a fixed subject without a line break', () => {
    const message = resetPasswordEmail(base);

    expect(message.subject).toBe('Reset your Errwise password');
    expect(message.subject).not.toMatch(/[\r\n]/);
  });

  it('puts the same link in the text part and in the html', () => {
    const message = resetPasswordEmail(base);

    expect(message.text).toContain(URL);
    expect(message.html).toContain(URL);
    expect(message.to).toBe('ada@example.com');
  });

  it('has exactly one primary button and no images', () => {
    const { html } = resetPasswordEmail(base);

    expect(html.match(/>\s*Reset password\s*</g)).toHaveLength(1);
    expect(html).not.toContain('<img');
  });

  it('says how long the link lasts, that it signs out everywhere, and what to do if not requested', () => {
    const { text, html } = resetPasswordEmail({ ...base, ttlMinutes: 30 });

    expect(text).toContain('valid for 30 minutes');
    expect(html).toContain('for 30 minutes');
    expect(text).toContain('signs you out of every device');
    expect(text).toContain('If you did not ask for this');
  });

  it('escapes the name a person typed, in the html', () => {
    const { html } = resetPasswordEmail({
      ...base,
      name: '<script>alert(1)</script>',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('greets without a name when there is none', () => {
    expect(resetPasswordEmail({ ...base, name: null }).text).toMatch(/^Hi,/);
  });
});
