import { Controller, Get, UseGuards } from '@nestjs/common';
import type { PublicUser } from '@errwise/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import type { AuthUser } from '../../common/types/auth-user';
import { UsersService } from './users.service';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  me(@CurrentUser() auth: AuthUser): Promise<PublicUser> {
    return this.users.getProfile(auth.id);
  }
}
