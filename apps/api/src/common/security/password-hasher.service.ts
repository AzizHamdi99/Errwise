import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import type { Env } from '../../config/env';

@Injectable()
export class PasswordHasher implements OnModuleInit {
  private readonly rounds: number;
  // Compared against when the email doesn't exist, so login takes the same time either way.
  private dummyHash = '';

  constructor(config: ConfigService<Env, true>) {
    this.rounds = config.get('BCRYPT_ROUNDS', { infer: true });
  }

  async onModuleInit(): Promise<void> {
    this.dummyHash = await bcrypt.hash('timing-attack-protection', this.rounds);
  }

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  async verify(hash: string | null, plain: string): Promise<boolean> {
    const ok = await bcrypt.compare(plain, hash ?? this.dummyHash);
    return hash !== null && ok;
  }
}
