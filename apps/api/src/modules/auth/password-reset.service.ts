import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { PasswordHasher } from '../../common/security/password-hasher.service';
import { sha256 } from '../../common/utils/hash';
import type { Env } from '../../config/env';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { resetPasswordEmail } from './emails/reset-password';
import { PasswordResetRepository } from './password-reset.repository';

const MINUTE_MS = 60_000;

const invalidLink = () =>
  new BadRequestException('This link is invalid or has expired');

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly repo: PasswordResetRepository,
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Mails a reset link. It does nothing, silently, when the email is unknown or a link was sent
   * less than the cooldown ago: the caller answers the same in every case, so this cannot be
   * used to find out which emails have an account. (The time it takes still differs; registering
   * already reveals existing emails, see ADR-006.)
   *
   * An account created with Google has no password: the link lets it set one, which is fine
   * because opening the link proves the address.
   */
  async request(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return;

    const pending = await this.repo.findByUserId(user.id);
    const cooldownMs =
      this.config.get('PASSWORD_RESET_RESEND_COOLDOWN_SECONDS', {
        infer: true,
      }) * 1000;
    if (pending && Date.now() - pending.sentAt.getTime() < cooldownMs) return;

    const ttlMinutes = this.config.get('PASSWORD_RESET_TTL_MINUTES', {
      infer: true,
    });
    const webUrl = this.config.get('WEB_URL', { infer: true });

    const token = randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);
    const now = new Date();
    await this.repo.save(
      user.id,
      tokenHash,
      new Date(now.getTime() + ttlMinutes * MINUTE_MS),
      now,
    );

    try {
      await this.mail.send(
        resetPasswordEmail({
          to: user.email,
          name: user.name,
          url: `${webUrl}/reset-password?token=${token}`,
          ttlMinutes,
        }),
      );
    } catch (e) {
      // Only the error message is logged: never the token or the link.
      this.logger.error(`Password reset email failed: ${(e as Error).message}`);
      await this.repo.deleteLink(user.id, tokenHash);
    }
  }

  /** One generic error for unknown, expired and already used links. */
  async reset(token: string, password: string): Promise<void> {
    const tokenHash = sha256(token);
    // A wrong token is refused before bcrypt, so guessing costs no CPU.
    if (!(await this.repo.isUsable(tokenHash, new Date()))) {
      throw invalidLink();
    }
    // Hashed before the transaction: bcrypt is slow on purpose and must not hold it open.
    const passwordHash = await this.hasher.hash(password);
    const done = await this.repo.consume(tokenHash, new Date(), passwordHash);
    if (!done) throw invalidLink();
  }
}
