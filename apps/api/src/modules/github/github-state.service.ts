import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../../config/env';

const STATE_PURPOSE = 'github-install';
const STATE_TTL_SECONDS = 10 * 60;

export interface GithubInstallState {
  projectId: string;
  organizationId: string;
  userId: string;
}

type StatePayload = GithubInstallState & { purpose?: string };

/** Signs and verifies the `state` sent through GitHub's install redirect. */
@Injectable()
export class GithubStateService {
  private readonly secret: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly jwt: JwtService,
  ) {
    this.secret = config.get('GITHUB_STATE_SECRET', { infer: true });
  }

  sign(state: GithubInstallState): Promise<string> {
    return this.jwt.signAsync(
      { ...state, purpose: STATE_PURPOSE },
      {
        secret: this.secret,
        algorithm: 'HS256',
        expiresIn: STATE_TTL_SECONDS,
      },
    );
  }

  async verify(token: string): Promise<GithubInstallState> {
    try {
      const payload = await this.jwt.verifyAsync<StatePayload>(token, {
        secret: this.secret,
        algorithms: ['HS256'],
      });
      if (payload.purpose !== STATE_PURPOSE) throw new Error('wrong purpose');
      return {
        projectId: payload.projectId,
        organizationId: payload.organizationId,
        userId: payload.userId,
      };
    } catch {
      throw new BadRequestException(
        'Invalid or expired GitHub connection state',
      );
    }
  }
}
