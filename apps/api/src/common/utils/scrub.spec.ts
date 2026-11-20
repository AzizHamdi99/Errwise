import type { EventInput } from '@errwise/shared';
import { scrubEvent, scrubText } from './scrub';

function event(overrides: Partial<EventInput> = {}): EventInput {
  return {
    eventId: '0198a2b4-7c1e-7a3b-8f00-1234567890ab',
    message: 'boom',
    level: 'error',
    environment: 'production',
    platform: 'node',
    ...overrides,
  };
}

const scrubMessage = (message: string) =>
  scrubEvent(event({ message })).event.message;

describe('scrubEvent', () => {
  describe('strings', () => {
    it('masks email addresses', () => {
      expect(scrubMessage('User bob.smith+tag@example.co.uk not found')).toBe(
        'User [email] not found',
      );
    });

    it('masks bearer tokens and authorization headers', () => {
      expect(scrubMessage('failed with Bearer abcdef1234567890xyz')).toBe(
        'failed with Bearer [token]',
      );
      expect(
        scrubMessage('Authorization: Bearer abcdef1234567890xyz, retry'),
      ).toBe('Authorization: [token], retry');
    });

    it('masks JWTs', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTYifQ.c2lnbmF0dXJlMTIzNDU2';
      expect(scrubMessage(`bad token ${jwt}`)).toBe('bad token [jwt]');
    });

    it('masks provider keys', () => {
      const key = `ew_live_${'a'.repeat(32)}`;
      expect(scrubMessage(`key ${key}`)).toBe('key [key]');
      expect(scrubMessage(`AWS AKIAABCDEFGHIJKLMNOP used`)).toBe(
        'AWS [key] used',
      );
      expect(scrubMessage(`gh ghp_${'A'.repeat(36)}`)).toBe('gh [key]');
      expect(scrubMessage(`openai sk-${'b'.repeat(40)}`)).toBe('openai [key]');
    });

    it('masks credentials inside URLs but keeps the rest', () => {
      expect(
        scrubMessage('connect postgres://admin:s3cret@db.internal:5432/app'),
      ).toBe('connect postgres://[credentials]@db.internal:5432/app');
    });

    it('masks card numbers that pass the Luhn check only', () => {
      expect(scrubMessage('card 4242 4242 4242 4242 declined')).toBe(
        'card [card] declined',
      );
      expect(scrubMessage('order 1234567812345678 failed')).toBe(
        'order 1234567812345678 failed',
      );
    });

    it('leaves ordinary text alone', () => {
      const text =
        "Cannot read properties of undefined (reading 'name') at risk-score";
      expect(scrubMessage(text)).toBe(text);
    });
  });

  describe('context', () => {
    it('redacts values of sensitive keys at any depth, including arrays', () => {
      const { event: out, redactions } = scrubEvent(
        event({
          context: {
            request: {
              headers: { Authorization: 'Bearer xyz', host: 'a.com' },
            },
            password: 'hunter2',
            list: [{ apiKey: 'k' }, { ok: 1 }],
            extra: { note: 'mail me at a@b.com' },
          },
        }),
      );
      expect(out.context).toEqual({
        request: { headers: { Authorization: '[redacted]', host: 'a.com' } },
        password: '[redacted]',
        list: [{ apiKey: '[redacted]' }, { ok: 1 }],
        extra: { note: 'mail me at [email]' },
      });
      expect(redactions).toBe(4);
    });

    it('does not let a __proto__ key change the prototype', () => {
      const context = JSON.parse(
        '{"__proto__":{"polluted":true},"a":1}',
      ) as Record<string, unknown>;
      const out = scrubEvent(event({ context })).event.context;
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
      expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
      expect(out?.a).toBe(1);
    });

    it('truncates very deep structures', () => {
      let deep: Record<string, unknown> = { leaf: 'x' };
      for (let i = 0; i < 20; i++) deep = { n: deep };
      const out = JSON.stringify(
        scrubEvent(event({ context: deep })).event.context,
      );
      expect(out).toContain('[truncated]');
    });
  });

  describe('stack and type', () => {
    it('scrubs the stack and the type', () => {
      const out = scrubEvent(
        event({
          type: 'Error for a@b.com',
          stack:
            'Error: x\n    at f (/app/a.js:1:1) token=Bearer abcdefgh12345',
        }),
      ).event;
      expect(out.type).toBe('Error for [email]');
      expect(out.stack).not.toContain('abcdefgh12345');
    });
  });

  describe('properties', () => {
    it('never mutates the input', () => {
      const input = event({
        message: 'a@b.com',
        context: { password: 'p', nested: { email: 'a@b.com' } },
      });
      const snapshot = structuredClone(input);
      scrubEvent(input);
      expect(input).toEqual(snapshot);
    });

    it('is idempotent', () => {
      const once = scrubEvent(
        event({
          message: 'a@b.com Bearer abcdef1234567890 4242424242424242',
          context: { token: 't', note: 'x@y.org' },
        }),
      );
      const twice = scrubEvent(once.event);
      expect(twice.event).toEqual(once.event);
      expect(twice.redactions).toBe(0);
    });

    it('stays fast on hostile 50 KB strings', () => {
      const size = 50_000;
      const hostile = [
        'a'.repeat(size),
        `${'a'.repeat(size)}@`,
        'eyJ'.repeat(size / 3),
        'Bearer '.repeat(size / 7),
        '1 '.repeat(size / 2),
        'a@'.repeat(size / 2),
        `https://${'a:'.repeat(size / 2)}`,
      ];
      for (const message of hostile) {
        const start = performance.now();
        scrubEvent(event({ message, stack: message }));
        expect(performance.now() - start).toBeLessThan(500);
      }
    });
  });
});

describe('scrubText', () => {
  it('scrubs free text such as a line of source code', () => {
    const out = scrubText(
      "const owner = 'dev@acme.io'; // Bearer abcdef1234567890xyz",
    );
    expect(out).not.toContain('dev@acme.io');
    expect(out).not.toContain('abcdef1234567890xyz');
    expect(out).toContain('[email]');
  });

  it('leaves ordinary code alone', () => {
    const code = '  47 | return user.name;';
    expect(scrubText(code)).toBe(code);
  });
});
