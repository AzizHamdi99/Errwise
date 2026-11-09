import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { GoogleProfile } from './google.strategy';

@Injectable()
export class GoogleAuthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Finds, links or creates the user for a verified Google profile. */
  async resolveUser(profile: GoogleProfile): Promise<User> {
    const now = new Date();

    const byGoogleId = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });
    if (byGoogleId) {
      return this.prisma.user.update({
        where: { id: byGoogleId.id },
        data: { lastLoginAt: now },
      });
    }

    const byEmail = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });
    if (byEmail) {
      // Google verified this email, so linking is safe. If the password account
      // never proved it owns the email, drop its password: someone else may have
      // created it with this address.
      return this.prisma.user.update({
        where: { id: byEmail.id },
        data: {
          googleId: profile.googleId,
          emailVerifiedAt: byEmail.emailVerifiedAt ?? now,
          passwordHash: byEmail.emailVerifiedAt ? byEmail.passwordHash : null,
          lastLoginAt: now,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        googleId: profile.googleId,
        emailVerifiedAt: now,
        lastLoginAt: now,
      },
    });
  }
}
