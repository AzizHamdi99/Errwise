import { BadRequestException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { sha256 } from '../../common/utils/hash';
import type { Env } from '../../config/env';
import type { MailMessage } from '../mail/mail.service';
import type { UsersService } from '../users/users.service';
import type { EmailVerificationRepository } from './email-verification.repository';
import { EmailVerificationService } from './email-verification.service';

const NOW = new Date('2026-11-21T12:00:00.000Z');
const HOUR = 3_600_000;
const CONFIG: Record<string, unknown> = {
  EMAIL_VERIFICATION_TTL_HOURS: 24,
  EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: 60,
  WEB_URL: 'https://app.test',
};

const user = (overrides: Partial<User> = {}): User =>
  ({
    id: 'u1',
    email: 'ada@example.com',
    name: 'Ada',
    emailVerifiedAt: null,
    ...overrides,
  }) as User;

interface Options {
  mailFails?: boolean;
  /** The account the email belongs to, if any. */
  found?: User | null;
  /** The link already waiting for that account, if any. */
  pendingSentAt?: Date;
  consumeResult?: boolean;
}

function setup(options: Options = {}) {
  const saved: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    sentAt: Date;
  }[] = [];
  const deleted: { userId: string; tokenHash: string }[] = [];
  const consumed: { tokenHash: string; now: Date }[] = [];
  const sent: MailMessage[] = [];

  const repo = {
    save: jest.fn(
      (userId: string, tokenHash: string, expiresAt: Date, sentAt: Date) => {
        saved.push({ userId, tokenHash, expiresAt, sentAt });
        return Promise.resolve();
      },
    ),
    findByUserId: jest.fn((userId: string) => {
      void userId;
      return Promise.resolve(
        options.pendingSentAt ? { sentAt: options.pendingSentAt } : null,
      );
    }),
    deleteLink: jest.fn((userId: string, tokenHash: string) => {
      deleted.push({ userId, tokenHash });
      return Promise.resolve();
    }),
    consume: jest.fn((tokenHash: string, now: Date) => {
      consumed.push({ tokenHash, now });
      return Promise.resolve(options.consumeResult ?? true);
    }),
  };
  const users = {
    findByEmail: jest.fn((email: string) => {
      void email;
      return Promise.resolve(options.found ?? null);
    }),
  };
  const mail = {
    send: jest.fn((message: MailMessage) => {
      if (options.mailFails) return Promise.reject(new Error('smtp down'));
      sent.push(message);
      return Promise.resolve();
    }),
  };
  const config = { get: (key: string) => CONFIG[key] };

  const service = new EmailVerificationService(
    repo as unknown as EmailVerificationRepository,
    users as unknown as UsersService,
    mail,
    config as unknown as ConfigService<Env, true>,
  );
  return { service, repo, users, mail, saved, deleted, consumed, sent };
}

/** The raw token a person would get from the link in the email. */
const tokenIn = (message: MailMessage): string =>
  /token=([A-Za-z0-9_-]+)/.exec(message.text)?.[1] ?? '';

beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
afterEach(() => jest.useRealTimers());

describe('EmailVerificationService.send', () => {
  it('stores only the hash of the token and mails the raw one in a link', async () => {
    const { service, saved, sent } = setup();

    expect(await service.send(user())).toBe(true);

    const token = tokenIn(sent[0]);
    expect(token).toHaveLength(43); // 32 random bytes in base64url
    expect(saved).toHaveLength(1);
    expect(saved[0].tokenHash).toBe(sha256(token));
    expect(saved[0].tokenHash).not.toBe(token);
    expect(JSON.stringify(saved)).not.toContain(token);
    expect(sent[0].text).toContain(
      `https://app.test/verify-email?token=${token}`,
    );
    expect(sent[0].to).toBe('ada@example.com');
  });

  it('expires the link after the configured number of hours', async () => {
    const { service, saved } = setup();
    await service.send(user());

    expect(saved[0].sentAt).toEqual(NOW);
    expect(saved[0].expiresAt).toEqual(new Date(NOW.getTime() + 24 * HOUR));
  });

  it('makes a different token every time', async () => {
    const { service, sent } = setup();
    await service.send(user());
    await service.send(user());

    expect(tokenIn(sent[0])).not.toBe(tokenIn(sent[1]));
  });

  it('returns false, keeps no link and does not throw when the email cannot be sent', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { service, saved, deleted } = setup({ mailFails: true });

    await expect(service.send(user())).resolves.toBe(false);

    // the link nobody received is removed, and it is the one that was just saved
    expect(deleted).toEqual([{ userId: 'u1', tokenHash: saved[0].tokenHash }]);
    error.mockRestore();
  });

  it('never writes the token or the link in the logs', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const { service, saved } = setup({ mailFails: true });

    await service.send(user());

    const logged = JSON.stringify(error.mock.calls);
    expect(logged).not.toContain(saved[0].tokenHash);
    expect(logged).not.toContain('verify-email?token');
    error.mockRestore();
  });
});

describe('EmailVerificationService.resend', () => {
  it('does nothing for an email without an account', async () => {
    const { service, mail, repo } = setup({ found: null });

    await expect(service.resend('nobody@example.com')).resolves.toBeUndefined();
    expect(mail.send).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('does nothing for an account that is already verified', async () => {
    const { service, mail } = setup({
      found: user({ emailVerifiedAt: NOW }),
    });

    await service.resend('ada@example.com');
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('does nothing while the previous email is younger than the cooldown', async () => {
    const { service, mail } = setup({
      found: user(),
      pendingSentAt: new Date(NOW.getTime() - 59_000),
    });

    await service.resend('ada@example.com');
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('sends again once the cooldown is over', async () => {
    const { service, mail } = setup({
      found: user(),
      pendingSentAt: new Date(NOW.getTime() - 60_000),
    });

    await service.resend('ada@example.com');
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('sends when no link was ever made (an account from before this feature)', async () => {
    const { service, mail } = setup({ found: user() });

    await service.resend('ada@example.com');
    expect(mail.send).toHaveBeenCalledTimes(1);
  });
});

describe('EmailVerificationService.verify', () => {
  it('uses the hash of the token, never the token itself', async () => {
    const { service, consumed } = setup();

    await service.verify('the-raw-token-from-the-link');

    expect(consumed).toEqual([
      { tokenHash: sha256('the-raw-token-from-the-link'), now: NOW },
    ]);
  });

  it('answers one generic error for an unknown, expired or used link', async () => {
    const { service } = setup({ consumeResult: false });

    const error = await service.verify('whatever').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toBe(
      'This link is invalid or has expired',
    );
  });
});
