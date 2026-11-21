/**
 * Checks the email verification against the real local database, with the real service and
 * repository (only the mail sender is a stub that keeps what it was asked to send):
 *  - the database holds the hash of the token, never the token;
 *  - a link verifies the email once; a second use, an expired link and a replaced link fail;
 *  - eight requests with the same link at once: exactly one wins;
 *  - the resend cooldown, a mail failure, and the cascade when a user is deleted.
 * It creates throw-away users (email prefix "verify-ev-") and deletes them at the end.
 *
 *   yarn workspace @errwise/api exec tsx scripts/verify-email-verification.ts
 */
import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { sha256 } from '../src/common/utils/hash';
import type { Env } from '../src/config/env';
import { EmailVerificationRepository } from '../src/modules/auth/email-verification.repository';
import { EmailVerificationService } from '../src/modules/auth/email-verification.service';
import type { MailMessage } from '../src/modules/mail/mail.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { UsersService } from '../src/modules/users/users.service';
import { createPerfClient } from './perf/perf-guard';

const prisma = createPerfClient();
const repo = new EmailVerificationRepository(prisma as never);
const users = new UsersService(new UsersRepository(prisma as never));

const CONFIG: Record<string, unknown> = {
  EMAIL_VERIFICATION_TTL_HOURS: 24,
  EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS: 60,
  WEB_URL: 'https://app.test',
};
const config = { get: (key: string) => CONFIG[key] };

const PREFIX = 'verify-ev-';
let failed = false;

function check(ok: boolean, text: string): void {
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${text}`);
}

function makeService(mailFails = false) {
  const sent: MailMessage[] = [];
  const mail = {
    send: (message: MailMessage) => {
      if (mailFails) return Promise.reject(new Error('smtp down'));
      sent.push(message);
      return Promise.resolve();
    },
  };
  const service = new EmailVerificationService(
    repo,
    users,
    mail,
    config as unknown as ConfigService<Env, true>,
  );
  return { service, sent };
}

const tokenIn = (message: MailMessage | undefined): string =>
  /token=([A-Za-z0-9_-]+)/.exec(message?.text ?? '')?.[1] ?? '';

async function newUser() {
  return prisma.user.create({
    data: { email: `${PREFIX}${randomUUID()}@example.test`, passwordHash: 'x' },
  });
}

const verified = async (id: string) =>
  (await prisma.user.findUniqueOrThrow({ where: { id } })).emailVerifiedAt;
const rejectedAsInvalid = (promise: Promise<unknown>) =>
  promise.then(
    () => false,
    (e: unknown) => e instanceof BadRequestException,
  );

async function cleanup(): Promise<void> {
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
}

async function main(): Promise<void> {
  await cleanup();

  // 1. What is stored.
  {
    const user = await newUser();
    const { service, sent } = makeService();
    check(
      (await service.send(user)) === true,
      'send() reports that the email was sent',
    );
    const token = tokenIn(sent[0]);
    const row = await prisma.emailVerification.findUniqueOrThrow({
      where: { userId: user.id },
    });
    check(
      row.tokenHash === sha256(token),
      'the row holds the sha256 of the token',
    );
    check(
      !JSON.stringify(row).includes(token),
      'the raw token is not in the database',
    );
    const hours = (row.expiresAt.getTime() - row.sentAt.getTime()) / 3_600_000;
    check(hours === 24, `the link lasts 24 hours (${hours})`);

    // 2. Using it once.
    await service.verify(token);
    check((await verified(user.id)) !== null, 'the link verifies the email');
    check(
      (await prisma.emailVerification.count({ where: { userId: user.id } })) ===
        0,
      'and the link is used up (row deleted)',
    );
    check(
      await rejectedAsInvalid(service.verify(token)),
      'a second use of the same link fails',
    );
  }

  // 3. A newer link replaces the older one.
  {
    const user = await newUser();
    const { service, sent } = makeService();
    await service.send(user);
    await service.send(user);
    const [first, second] = [tokenIn(sent[0]), tokenIn(sent[1])];
    check(
      (await prisma.emailVerification.count({ where: { userId: user.id } })) ===
        1,
      'still one row per user after two sends',
    );
    check(
      await rejectedAsInvalid(service.verify(first)),
      'the replaced link no longer works',
    );
    await service.verify(second);
    check((await verified(user.id)) !== null, 'the newest link works');
  }

  // 4. An expired link.
  {
    const user = await newUser();
    const { service } = makeService();
    await repo.save(
      user.id,
      sha256('expired-token-0123456789'),
      new Date(Date.now() - 1000),
      new Date(),
    );
    check(
      await rejectedAsInvalid(service.verify('expired-token-0123456789')),
      'an expired link fails',
    );
    check((await verified(user.id)) === null, 'and the email stays unverified');
  }

  // 5. Eight uses of the same link at once: one winner.
  {
    const user = await newUser();
    const { service, sent } = makeService();
    await service.send(user);
    const token = tokenIn(sent[0]);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => service.verify(token)),
    );
    const wins = results.filter((r) => r.status === 'fulfilled').length;
    check(
      wins === 1,
      `8 parallel uses of one link: exactly one wins (${wins})`,
    );
    check(
      results
        .filter((r) => r.status === 'rejected')
        .every(
          (r) =>
            (r as PromiseRejectedResult).reason instanceof BadRequestException,
        ),
      'the others get the generic error, not a crash',
    );
    check((await verified(user.id)) !== null, 'and the email is verified');
  }

  // 6. A user who verified another way (Google, an invitation) keeps the original date.
  {
    const user = await newUser();
    const original = new Date('2026-01-01T00:00:00.000Z');
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: original },
    });
    const { service, sent } = makeService();
    await service.send(user);
    await service.verify(tokenIn(sent[0]));
    check(
      (await verified(user.id))?.getTime() === original.getTime(),
      'an already verified user keeps their original verification date',
    );
  }

  // 7. The resend cooldown, with the real clock and row.
  {
    const user = await newUser();
    const { service, sent } = makeService();
    await service.send(user);
    await service.resend(user.email);
    check(
      sent.length === 1,
      'resend right after a send does nothing (cooldown)',
    );

    await repo.save(
      user.id,
      sha256('old-link-0123456789abcdef'),
      new Date(Date.now() + 3_600_000),
      new Date(Date.now() - 61_000),
    );
    await service.resend(user.email);
    check(sent.length === 2, 'resend after the cooldown sends a new link');

    await service.resend(`${PREFIX}nobody@example.test`);
    check(sent.length === 2, 'resend for an unknown email sends nothing');
  }

  // 8. A mail failure keeps no link; the account stays.
  {
    const user = await newUser();
    const { service } = makeService(true);
    check(
      (await service.send(user)) === false,
      'send() returns false when the mail fails',
    );
    check(
      (await prisma.emailVerification.count({ where: { userId: user.id } })) ===
        0,
      'and no link is kept for an email nobody received',
    );
    check(
      !!(await prisma.user.findUnique({ where: { id: user.id } })),
      'the account is kept',
    );
  }

  // 9. Deleting a user deletes the link.
  {
    const user = await newUser();
    const { service } = makeService();
    await service.send(user);
    await prisma.user.delete({ where: { id: user.id } });
    check(
      (await prisma.emailVerification.count({ where: { userId: user.id } })) ===
        0,
      'deleting the user deletes the pending link (cascade)',
    );
  }
}

main()
  .catch((error: unknown) => {
    failed = true;
    console.error(error instanceof Error ? error.message : error);
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    process.exitCode = failed ? 1 : 0;
  });
