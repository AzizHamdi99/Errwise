import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PublicMember } from '@errwise/shared';
import { toOrgRole, toPublicMember } from './memberships.mapper';
import { MembershipsRepository } from './memberships.repository';
import type { OrgMembership } from './memberships.types';

@Injectable()
export class MembershipsService {
  constructor(private readonly repo: MembershipsRepository) {}

  async findActive(
    userId: string,
    organizationId: string,
  ): Promise<OrgMembership | null> {
    const m = await this.repo.findActive(userId, organizationId);
    if (!m) return null;
    return {
      userId: m.userId,
      organizationId: m.organizationId,
      role: toOrgRole(m.role),
    };
  }

  async list(organizationId: string): Promise<PublicMember[]> {
    const members = await this.repo.listByOrganization(organizationId);
    return members.map(toPublicMember);
  }

  async changeRole(
    organizationId: string,
    targetUserId: string,
    role: 'admin' | 'member',
  ): Promise<PublicMember> {
    const target = await this.repo.find(targetUserId, organizationId);
    if (!target) throw new NotFoundException('Member not found');
    if (target.role === 'owner') {
      throw new ForbiddenException('The owner role cannot be changed');
    }
    return toPublicMember(
      await this.repo.updateRole(targetUserId, organizationId, role),
    );
  }

  async remove(actor: OrgMembership, targetUserId: string): Promise<void> {
    const target = await this.repo.find(targetUserId, actor.organizationId);
    if (!target) throw new NotFoundException('Member not found');

    if (target.role === 'owner') {
      throw new ForbiddenException(
        'The owner cannot leave or be removed. Delete the organization instead',
      );
    }

    const isSelf = actor.userId === targetUserId;
    if (!isSelf) {
      if (actor.role === 'member') {
        throw new ForbiddenException('Insufficient role');
      }
      if (actor.role === 'admin' && target.role !== 'member') {
        throw new ForbiddenException('Admins can only remove members');
      }
    }

    await this.repo.delete(targetUserId, actor.organizationId);
  }
}
