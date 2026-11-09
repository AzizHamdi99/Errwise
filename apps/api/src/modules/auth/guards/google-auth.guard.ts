import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  // If the user cancels or the check fails, don't answer with a JSON 401:
  // the controller redirects back to the login page instead.
  handleRequest<T>(_err: unknown, user: T): T {
    return user;
  }
}
