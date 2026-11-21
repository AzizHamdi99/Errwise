import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { EMAIL_NOT_VERIFIED } from '@errwise/shared';
import type { ClientMeta } from '../../common/decorators/client-meta.decorator';
import type { PasswordHasher } from '../../common/security/password-hasher.service';
import type { TokenService } from '../../common/security/token.service';
import type { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import type { EmailVerificationService } from './email-verification.service';
import type { GoogleAuthService } from './google-auth.service';
import type { RefreshTokenService } from './refresh-token.service';

const META: ClientMeta = { userAgent: 'test', ip: '127.0.0.1' };
const VERIFIED_AT = new Date('2026-11-01T00:00:00.000Z');

const user = (overrides: Partial<User> = {}): User =>
  ({
    id: 'u1',
    email: 'ada@example.com',
    name: 'Ada',
    passwordHash: 'stored-hash',
    emailVerifiedAt: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  }) as User;

interface Options {
  /** What the database has for the email or id being asked about. */
  existing?: User | null;
  /** Whether the typed password matches. */
  passwordOk?: boolean;
  emailSent?: boolean;
  duplicateEmail?: boolean;
}

function setup(options: Options = {}) {
  const created: { email: string; name?: string; passwordHash: string }[] = [];
  const hashed: string[] = [];

  const users = {
    create: jest.fn(
      (data: { email: string; name?: string; passwordHash: string }) => {
        if (options.duplicateEmail) {
          return Promise.reject(
            new ConflictException('Email is already registered'),
          );
        }
        created.push(data);
        return Promise.resolve(
          user({ email: data.email, name: data.name ?? null }),
        );
      },
    ),
    findByEmail: jest.fn((email: string) => {
      void email;
      return Promise.resolve(options.existing ?? null);
    }),
    findById: jest.fn((id: string) => {
      void id;
      return Promise.resolve(options.existing ?? null);
    }),
    touchLastLogin: jest.fn((id: string) => {
      void id;
      return Promise.resolve(options.existing as User);
    }),
  };
  const hasher = {
    hash: jest.fn((plain: string) => {
      hashed.push(plain);
      return Promise.resolve('new-hash');
    }),
    verify: jest.fn((hash: string | null, plain: string) => {
      void hash;
      void plain;
      return Promise.resolve(options.passwordOk ?? true);
    }),
  };
  const tokens = {
    signAccessToken: jest.fn((payload: { sub: string; email: string }) => {
      void payload;
      return Promise.resolve('access-token');
    }),
  };
  const refreshTokens = {
    issue: jest.fn((userId: string, meta: ClientMeta) => {
      void userId;
      void meta;
      return Promise.resolve('refresh-token');
    }),
    rotate: jest.fn((raw: string, meta: ClientMeta) => {
      void raw;
      void meta;
      return Promise.resolve({ userId: 'u1', refreshToken: 'rotated' });
    }),
    revoke: jest.fn(),
  };
  const emailVerification = {
    send: jest.fn((target: User) => {
      void target;
      return Promise.resolve(options.emailSent ?? true);
    }),
  };

  const service = new AuthService(
    users as unknown as UsersService,
    hasher as unknown as PasswordHasher,
    tokens as unknown as TokenService,
    refreshTokens as unknown as RefreshTokenService,
    {} as GoogleAuthService,
    emailVerification as unknown as EmailVerificationService,
  );
  return {
    service,
    users,
    hasher,
    tokens,
    refreshTokens,
    emailVerification,
    created,
    hashed,
  };
}

describe('AuthService.register', () => {
  const input = {
    email: 'ada@example.com',
    password: 'a-long-password',
    name: 'Ada',
  };

  it('creates the account with a hashed password and sends the verification email', async () => {
    const { service, created, hashed, emailVerification } = setup();

    const result = await service.register(input);

    expect(hashed).toEqual(['a-long-password']);
    expect(created[0].passwordHash).toBe('new-hash');
    expect(JSON.stringify(created)).not.toContain('a-long-password');
    expect(emailVerification.send).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      email: 'ada@example.com',
      verificationEmailSent: true,
    });
  });

  it('does NOT sign the user in: no session of any kind is started', async () => {
    const { service, tokens, refreshTokens } = setup();

    const result = await service.register(input);

    expect(tokens.signAccessToken).not.toHaveBeenCalled();
    expect(refreshTokens.issue).not.toHaveBeenCalled();
    expect(Object.keys(result).sort()).toEqual([
      'email',
      'verificationEmailSent',
    ]);
  });

  it('keeps the account and says so when the email could not be sent', async () => {
    const { service } = setup({ emailSent: false });

    await expect(service.register(input)).resolves.toEqual({
      email: 'ada@example.com',
      verificationEmailSent: false,
    });
  });

  it('answers 409 for an email that already exists, and sends nothing', async () => {
    const { service, emailVerification } = setup({ duplicateEmail: true });

    await expect(service.register(input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(emailVerification.send).not.toHaveBeenCalled();
  });
});

describe('AuthService.login', () => {
  const input = { email: 'ada@example.com', password: 'a-long-password' };

  it('signs in a verified account', async () => {
    const verified = user({ emailVerifiedAt: VERIFIED_AT });
    const { service, users } = setup({ existing: verified });

    const session = await service.login(input, META);

    expect(session.accessToken).toBe('access-token');
    expect(session.refreshToken).toBe('refresh-token');
    expect(users.touchLastLogin).toHaveBeenCalledWith('u1');
  });

  it('refuses an unverified account with the EMAIL_NOT_VERIFIED code, and starts no session', async () => {
    const { service, users, tokens, refreshTokens } = setup({
      existing: user({ emailVerifiedAt: null }),
    });

    const error = await service.login(input, META).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: EMAIL_NOT_VERIFIED,
    });
    expect(users.touchLastLogin).not.toHaveBeenCalled();
    expect(tokens.signAccessToken).not.toHaveBeenCalled();
    expect(refreshTokens.issue).not.toHaveBeenCalled();
  });

  // If the 403 came first, anyone could find out which emails are registered but unverified.
  it('answers 401, not 403, for an unverified account when the password is wrong', async () => {
    const { service } = setup({
      existing: user({ emailVerifiedAt: null }),
      passwordOk: false,
    });

    await expect(service.login(input, META)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('answers 401 for an email without an account', async () => {
    const { service } = setup({ existing: null, passwordOk: false });

    await expect(service.login(input, META)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('AuthService.refresh', () => {
  it('refuses a session whose account is not verified', async () => {
    const { service } = setup({ existing: user({ emailVerifiedAt: null }) });

    await expect(service.refresh('raw', META)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('refuses a session whose account no longer exists', async () => {
    const { service } = setup({ existing: null });

    await expect(service.refresh('raw', META)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('renews the session of a verified account', async () => {
    const { service } = setup({
      existing: user({ emailVerifiedAt: VERIFIED_AT }),
    });

    const session = await service.refresh('raw', META);

    expect(session.refreshToken).toBe('rotated');
    expect(session.accessToken).toBe('access-token');
  });
});
