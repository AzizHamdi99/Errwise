import { BadRequestException, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import type { PasswordHasher } from '../../common/security/password-hasher.service';
import { sha256 } from '../../common/utils/hash';
import type { Env } from '../../config/env';
import type { MailMessage } from '../mail/mail.service';
import type { UsersService } from '../users/users.service';
import type { PasswordResetRepository } from './password-reset.repository';
import { PasswordResetService } from './password-reset.service';

const NOW = new Date('2026-11-21T12:00:00.000Z');
const MINUTE = 60_000;
const CONFIG: Record<string, unknown> = {
  PASSWORD_RESET_TTL_MINUTES: 60,
  PASSWORD_RESET_RESEND_COOLDOWN_SECONDS: 60,
  WEB_URL: 'https://app.test',
};

const ada = {
  id: 'u1',
  email: 'ada@example.com',
  name: 'Ada',
  passwordHash: 'old-hash',
} as User;

interface Options {
  found?: User | null;
  pendingSentAt?: Date;
  mailFails?: boolean;
  usable?: boolean;
  consumeResult?: boolean;
}

function setup(options: Options = {}) {
  const repo = {
    save: jest.fn().mockResolvedValue(undefined),
    findByUserId: jest
      .fn()
      .mockResolvedValue(
        options.pendingSentAt ? { sentAt: options.pendingSentAt } : null,
      ),
    deleteLink: jest.fn().mockResolvedValue(undefined),
    isUsable: jest.fn().mockResolvedValue(options.usable ?? true),
    consume: jest.fn().mockResolvedValue(options.consumeResult ?? true),
  };
  const users = {
    findByEmail: jest
      .fn()
      .mockResolvedValue(options.found === undefined ? ada : options.found),
  };
  const hasher = { hash: jest.fn().mockResolvedValue('new-hash') };
  const sent: MailMessage[] = [];
  const mail = {
    send: jest.fn((message: MailMessage) => {
      if (options.mailFails) return Promise.reject(new Error('smtp down'));
      sent.push(message);
      return Promise.resolve();
    }),
  };
  const config = { get: (key: string) => CONFIG[key] };

  const service = new PasswordResetService(
    repo as unknown as PasswordResetRepository,
    users as unknown as UsersService,
    hasher as unknown as PasswordHasher,
    mail,
    config as unknown as ConfigService<Env, true>,
  );
  return { service, repo, users, hasher, mail, sent };
}

const tokenIn = (message: MailMessage): string =>
  /token=([A-Za-z0-9_-]+)/.exec(message.text)?.[1] ?? '';

beforeEach(() => jest.useFakeTimers().setSystemTime(NOW));
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('PasswordResetService.request', () => {
  it('stores only the hash of the token and mails the raw one in a link', async () => {
    const { service, repo, sent } = setup();

    await service.request('ada@example.com');

    const token = tokenIn(sent[0]);
    expect(token).toHaveLength(43);
    expect(sent[0].to).toBe('ada@example.com');
    expect(sent[0].text).toContain(
      `https://app.test/reset-password?token=${token}`,
    );
    expect(repo.save).toHaveBeenCalledWith(
      'u1',
      sha256(token),
      new Date(NOW.getTime() + 60 * MINUTE),
      NOW,
    );
    expect(JSON.stringify(repo.save.mock.calls)).not.toContain(token);
  });

  it('does nothing, silently, for an unknown email', async () => {
    const { service, repo, mail } = setup({ found: null });

    await expect(
      service.request('nobody@example.com'),
    ).resolves.toBeUndefined();

    expect(repo.save).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('does not send another link within the cooldown', async () => {
    const { service, mail } = setup({
      pendingSentAt: new Date(NOW.getTime() - 30_000),
    });

    await service.request('ada@example.com');

    expect(mail.send).not.toHaveBeenCalled();
  });

  it('sends a new link once the cooldown is over', async () => {
    const { service, mail } = setup({
      pendingSentAt: new Date(NOW.getTime() - 61_000),
    });

    await service.request('ada@example.com');

    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('lets an account without a password (Google) set one', async () => {
    const { service, mail } = setup({
      found: { ...ada, passwordHash: null },
    });

    await service.request('ada@example.com');

    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('never throws when the mail fails, and deletes the link nobody received', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, repo } = setup({ mailFails: true });

    await expect(service.request('ada@example.com')).resolves.toBeUndefined();

    const [, savedHash] = repo.save.mock.calls[0] as [string, string];
    expect(repo.deleteLink).toHaveBeenCalledWith('u1', savedHash);
  });
});

describe('PasswordResetService.reset', () => {
  it('hashes the new password and uses the link', async () => {
    const { service, repo, hasher } = setup();

    await service.reset('raw-token', 'new-password-123');

    expect(hasher.hash).toHaveBeenCalledWith('new-password-123');
    expect(repo.consume).toHaveBeenCalledWith(
      sha256('raw-token'),
      NOW,
      'new-hash',
    );
  });

  it('refuses an unknown or expired link before spending a bcrypt hash', async () => {
    const { service, repo, hasher } = setup({ usable: false });

    await expect(
      service.reset('raw-token', 'new-password-123'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(hasher.hash).not.toHaveBeenCalled();
    expect(repo.consume).not.toHaveBeenCalled();
  });

  it('gives the same error when another request used the link first', async () => {
    const { service } = setup({ consumeResult: false });

    await expect(
      service.reset('raw-token', 'new-password-123'),
    ).rejects.toThrow('This link is invalid or has expired');
  });
});
