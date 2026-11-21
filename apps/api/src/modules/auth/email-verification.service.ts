import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { User } from '@prisma/client';
import { sha256 } from '../../common/utils/hash';
import type { Env } from '../../config/env';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { verifyEmail } from './emails/verify-email';
import { EmailVerificationRepository } from './email-verification.repository';

const HOUR_MS = 3_600_000;

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly repo: EmailVerificationRepository,
    private readonly users: UsersService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Makes a new link for the user (the previous one stops working) and mails it. Returns whether
   * the email was sent. A mail failure never throws: the account exists either way, and the user
   * can ask for another link. A link nobody received is not kept.
   */
  async send(user: User): Promise<boolean> {
    const ttlHours = this.config.get('EMAIL_VERIFICATION_TTL_HOURS', {
      infer: true,
    });
    const webUrl = this.config.get('WEB_URL', { infer: true });

    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);
    const now = new Date();
    await this.repo.save(
      user.id,
      tokenHash,
      new Date(now.getTime() + ttlHours * HOUR_MS),
      now,
    );

    try {
      await this.mail.send(
        verifyEmail({
          to: user.email,
          name: user.name,
          url: `${webUrl}/verify-email?token=${token}`,
          ttlHours,
        }),
      );
      return true;
    } catch (e) {
      // Only the error message is logged: never the token or the link.
      this.logger.error(`Verification email failed: ${(e as Error).message}`);
      await this.repo.deleteLink(user.id, tokenHash);
      return false;
    }
  }

  /**
   * Sends a new link to an account that is waiting for one. It does nothing, silently, when the
   * email is unknown, already verified, or a link was sent less than the cooldown ago: the caller
   * answers the same in every case, so this cannot be used to find out which emails have an
   * account. (The time it takes still differs; registering already reveals existing emails.)
   */
  async resend(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user || user.emailVerifiedAt) return;

    const pending = await this.repo.findByUserId(user.id);
    const cooldownMs =
      this.config.get('EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS', {
        infer: true,
      }) * 1000;
    if (pending && Date.now() - pending.sentAt.getTime() < cooldownMs) return;

    await this.send(user);
  }

  /** One generic error for unknown, expired and already used links. */
  async verify(token: string): Promise<void> {
    const verified = await this.repo.consume(sha256(token), new Date());
    if (!verified) {
      throw new BadRequestException('This link is invalid or has expired');
    }
  }
}
