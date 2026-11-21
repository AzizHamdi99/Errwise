import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PasswordHasher } from '../../common/security/password-hasher.service';
import type { SessionsService } from '../auth/sessions.service';
import type { UsersService } from '../users/users.service';
import { AccountService } from './account.service';

const INPUT = { currentPassword: 'old-password', newPassword: 'new-password' };

function setup(passwordHash: string | null = 'old-hash', valid = true) {
  const users = {
    getById: jest.fn().mockResolvedValue({ id: 'u1', passwordHash }),
    updatePasswordHash: jest.fn().mockResolvedValue(undefined),
    updateName: jest.fn().mockResolvedValue({ id: 'u1', name: 'Ada' }),
  };
  const hasher = {
    verify: jest.fn().mockResolvedValue(valid),
    hash: jest.fn().mockResolvedValue('new-hash'),
  };
  const sessions = { revokeOthers: jest.fn().mockResolvedValue(undefined) };
  const service = new AccountService(
    users as unknown as UsersService,
    hasher as unknown as PasswordHasher,
    sessions as unknown as SessionsService,
  );
  return { service, users, hasher, sessions };
}

describe('AccountService.changePassword', () => {
  it('saves the new hash and signs out every other device', async () => {
    const { service, users, hasher, sessions } = setup();

    await service.changePassword('u1', INPUT, 'raw-cookie');

    expect(hasher.verify).toHaveBeenCalledWith('old-hash', 'old-password');
    expect(users.updatePasswordHash).toHaveBeenCalledWith('u1', 'new-hash');
    expect(sessions.revokeOthers).toHaveBeenCalledWith('u1', 'raw-cookie');
  });

  it('refuses a wrong current password with a 400, and changes nothing', async () => {
    const { service, users, sessions } = setup('old-hash', false);

    await expect(
      service.changePassword('u1', INPUT, 'raw-cookie'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(users.updatePasswordHash).not.toHaveBeenCalled();
    expect(sessions.revokeOthers).not.toHaveBeenCalled();
  });

  it('sends an account without a password (Google) to the reset flow', async () => {
    const { service, hasher, users } = setup(null);

    await expect(
      service.changePassword('u1', INPUT, 'raw-cookie'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(hasher.verify).not.toHaveBeenCalled();
    expect(users.updatePasswordHash).not.toHaveBeenCalled();
  });
});

describe('AccountService.updateName', () => {
  it('updates the name of the signed-in user only', async () => {
    const { service, users } = setup();

    await service.updateName('u1', 'Ada');

    expect(users.updateName).toHaveBeenCalledWith('u1', 'Ada');
  });
});
