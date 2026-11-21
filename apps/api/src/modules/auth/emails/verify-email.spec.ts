import { verifyEmail } from './verify-email';

const URL = 'https://app.test/verify-email?token=abc_DEF-123';

const base = { to: 'ada@example.com', name: 'Ada', url: URL, ttlHours: 24 };

describe('verifyEmail', () => {
  it('has a fixed subject without a line break', () => {
    const message = verifyEmail(base);

    expect(message.subject).toBe('Verify your email for Errwise');
    expect(message.subject).not.toMatch(/[\r\n]/);
  });

  it('puts the same link in the text part and in the html', () => {
    const message = verifyEmail(base);

    expect(message.text).toContain(URL);
    expect(message.html).toContain(URL);
    expect(message.to).toBe('ada@example.com');
  });

  it('has exactly one primary button', () => {
    const { html } = verifyEmail(base);

    expect(html.match(/>\s*Verify email\s*</g)).toHaveLength(1);
    expect(html).not.toContain('<img');
  });

  it('says how long the link lasts and what to do if it was not requested', () => {
    const { text, html } = verifyEmail({ ...base, ttlHours: 12 });

    expect(text).toContain('valid for 12 hours');
    expect(html).toContain('valid for 12 hours');
    expect(text).toContain('did not create an Errwise account');
  });

  it('escapes the name a person typed, in the html', () => {
    const { html } = verifyEmail({
      ...base,
      name: '<script>alert(1)</script> & "co"',
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain(
      '&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;co&quot;',
    );
  });

  it('escapes the link in the html attributes', () => {
    const { html } = verifyEmail({ ...base, url: 'https://x.test/?a=1&b="2"' });

    expect(html).toContain('href="https://x.test/?a=1&amp;b=&quot;2&quot;"');
  });

  it('greets without a name when there is none', () => {
    const { text, html } = verifyEmail({ ...base, name: null });

    expect(text.startsWith('Hi,\n')).toBe(true);
    expect(html).toContain('Hi, confirm your email address');
  });
});
