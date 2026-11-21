import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { ChangePasswordInput, PublicUser } from '@errwise/shared';
import { PasswordHasher } from '../../common/security/password-hasher.service';
import { SessionsService } from '../auth/sessions.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class AccountService {
  constructor(
    private readonly users: UsersService,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionsService,
  ) {}

  updateName(userId: string, name: string): Promise<PublicUser> {
    return this.users.updateName(userId, name);
  }

  /**
   * Checks the current password, saves the new one and signs out every other device: whoever
   * knew the old password loses their session. The device that asked stays signed in.
   *
   * A wrong current password is a 400, not a 401: the web client treats 401 as "session expired"
   * and would try to refresh, then send the user to the login page.
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput,
    rawRefreshToken: string | undefined,
  ): Promise<void> {
    const user = await this.users.getById(userId);
    if (user.passwordHash === null) {
      throw new ConflictException(
        'This account signs in with Google and has no password. Use Forgot password to set one.',
      );
    }
    const valid = await this.hasher.verify(
      user.passwordHash,
      input.currentPassword,
    );
    if (!valid) throw new BadRequestException('Current password is incorrect');

    await this.users.updatePasswordHash(
      userId,
      await this.hasher.hash(input.newPassword),
    );
    await this.sessions.revokeOthers(userId, rawRefreshToken);
  }
}
