import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type {
  CreateInvitationInput,
  InvitationPreview,
  PublicInvitation,
  PublicOrganization,
} from '@errwise/shared';
import { sha256 } from '../../common/utils/hash';
import type { Env } from '../../config/env';
import { MailService } from '../mail/mail.service';
import { toOrgRole } from '../memberships/memberships.mapper';
import { MembershipsService } from '../memberships/memberships.service';
import type { OrgMembership } from '../memberships/memberships.types';
import { toPublicOrganization } from '../organizations/organizations.mapper';
import { UsersService } from '../users/users.service';
import { invitationEmail } from './emails/invitation-email';
import {
  inviterLabel,
  toInvitationPreview,
  toPublicInvitation,
} from './invitations.mapper';
import {
  InvitationsRepository,
  InvitationWithRelations,
} from './invitations.repository';

const DAY_MS = 86_400_000;
const MAX_PENDING_PER_ORG = 50;

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly repo: InvitationsRepository,
    private readonly users: UsersService,
    private readonly memberships: MembershipsService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ---- owner / admin side -------------------------------------------------

  async create(
    actor: OrgMembership,
    input: CreateInvitationInput,
  ): Promise<PublicInvitation> {
    this.assertCanManage(actor, input.role);

    if (
      (await this.repo.countPending(actor.organizationId)) >=
      MAX_PENDING_PER_ORG
    ) {
      throw new BadRequestException('Too many pending invitations');
    }
    if (await this.repo.isMember(actor.organizationId, input.email)) {
      throw new ConflictException('This user is already a member');
    }

    const { token, tokenHash, expiresAt } = this.newToken();
    const invitation = await this.repo.replacePending({
      organizationId: actor.organizationId,
      email: input.email,
      role: input.role,
      tokenHash,
      invitedById: actor.userId,
      expiresAt,
    });

    try {
      await this.deliver(invitation, token);
    } catch (e) {
      // Don't leave an invitation nobody received.
      await this.repo.revoke(invitation.id);
      this.logger.error(`Invitation email failed: ${(e as Error).message}`);
      throw new ServiceUnavailableException(
        'Could not send the invitation email',
      );
    }
    return toPublicInvitation(invitation);
  }

  async list(organizationId: string): Promise<PublicInvitation[]> {
    const invitations = await this.repo.listPending(organizationId);
    return invitations.map(toPublicInvitation);
  }

  async resend(
    actor: OrgMembership,
    invitationId: string,
  ): Promise<PublicInvitation> {
    const existing = await this.getPendingInOrganization(actor, invitationId);

    const { token, tokenHash, expiresAt } = this.newToken();
    const invitation = await this.repo.refresh(
      existing.id,
      tokenHash,
      expiresAt,
    );
    try {
      await this.deliver(invitation, token);
    } catch (e) {
      this.logger.error(`Invitation email failed: ${(e as Error).message}`);
      throw new ServiceUnavailableException(
        'Could not send the invitation email',
      );
    }
    return toPublicInvitation(invitation);
  }

  async revoke(actor: OrgMembership, invitationId: string): Promise<void> {
    const existing = await this.getPendingInOrganization(actor, invitationId);
    if (!(await this.repo.revoke(existing.id))) {
      throw new NotFoundException('Invitation not found');
    }
  }

  // ---- invitee side -------------------------------------------------------

  async preview(token: string): Promise<InvitationPreview> {
    return toInvitationPreview(await this.findUsable(token));
  }

  async accept(userId: string, token: string): Promise<PublicOrganization> {
    const invitation = await this.findUsable(token);
    const user = await this.users.getById(userId);

    if (user.email !== invitation.email) {
      throw new ForbiddenException(
        'This invitation was sent to a different email address',
      );
    }

    const accepted = await this.repo.accept({
      invitationId: invitation.id,
      userId,
      organizationId: invitation.organizationId,
      role: invitation.role,
    });
    if (!accepted) {
      throw new NotFoundException('Invitation is invalid or has expired');
    }

    // Read the real role: an existing member keeps theirs.
    const membership = await this.memberships.findActive(
      userId,
      invitation.organizationId,
    );
    return toPublicOrganization(
      invitation.organization,
      membership?.role ?? toOrgRole(invitation.role),
    );
  }

  // ---- helpers ------------------------------------------------------------

  /** Admins can only manage invitations for the member role. */
  private assertCanManage(actor: OrgMembership, invitedRole: string): void {
    if (actor.role === 'admin' && invitedRole !== 'member') {
      throw new ForbiddenException('Admins can only invite members');
    }
  }

  private async getPendingInOrganization(
    actor: OrgMembership,
    invitationId: string,
  ): Promise<InvitationWithRelations> {
    const inv = await this.repo.findInOrganization(
      invitationId,
      actor.organizationId,
    );
    if (!inv || inv.acceptedAt || inv.revokedAt) {
      throw new NotFoundException('Invitation not found');
    }
    this.assertCanManage(actor, inv.role);
    return inv;
  }

  /** A single generic error for unknown, used, revoked and expired tokens. */
  private async findUsable(token: string): Promise<InvitationWithRelations> {
    const inv = await this.repo.findByTokenHash(sha256(token));
    if (
      !inv ||
      inv.acceptedAt ||
      inv.revokedAt ||
      inv.expiresAt <= new Date() ||
      inv.organization.deletedAt !== null
    ) {
      throw new NotFoundException('Invitation is invalid or has expired');
    }
    return inv;
  }

  private newToken() {
    const ttlDays = this.config.get('INVITATION_TTL_DAYS', { infer: true });
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + ttlDays * DAY_MS),
    };
  }

  private deliver(inv: InvitationWithRelations, token: string): Promise<void> {
    const webUrl = this.config.get('WEB_URL', { infer: true });
    const ttlDays = this.config.get('INVITATION_TTL_DAYS', { infer: true });
    return this.mail.send(
      invitationEmail({
        to: inv.email,
        organizationName: inv.organization.name,
        inviterName: inviterLabel(inv),
        role: inv.role,
        url: `${webUrl}/invitations/accept?token=${token}`,
        ttlDays,
      }),
    );
  }
}
