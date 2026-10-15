import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateOrganizationInput,
  OrgRole,
  PublicOrganization,
  UpdateOrganizationInput,
} from '@errwise/shared';
import { randomSlugSuffix, slugify } from '../../common/utils/slug';
import { toOrgRole } from '../memberships/memberships.mapper';
import { toPublicOrganization } from './organizations.mapper';
import { OrganizationsRepository } from './organizations.repository';

const MAX_SLUG_ATTEMPTS = 5;

@Injectable()
export class OrganizationsService {
  constructor(private readonly repo: OrganizationsRepository) {}

  async create(
    userId: string,
    input: CreateOrganizationInput,
  ): Promise<PublicOrganization> {
    const base = slugify(input.name);

    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${randomSlugSuffix()}`;
      try {
        const org = await this.repo.createWithOwner({
          name: input.name,
          slug,
          ownerId: userId,
        });
        return toPublicOrganization(org, 'owner');
      } catch (e) {
        const taken =
          e instanceof Prisma.PrismaClientKnownRequestError &&
          e.code === 'P2002';
        if (!taken) throw e;
      }
    }
    throw new ConflictException('Could not generate a unique slug');
  }

  async listForUser(userId: string): Promise<PublicOrganization[]> {
    const memberships = await this.repo.listForUser(userId);
    return memberships.map((m) =>
      toPublicOrganization(m.organization, toOrgRole(m.role)),
    );
  }

  async getById(id: string, role: OrgRole): Promise<PublicOrganization> {
    const org = await this.repo.findById(id);
    if (!org) throw new NotFoundException('Organization not found');
    return toPublicOrganization(org, role);
  }

  async update(
    id: string,
    role: OrgRole,
    input: UpdateOrganizationInput,
  ): Promise<PublicOrganization> {
    await this.getById(id, role); // 404 if missing or deleted
    const org = await this.repo.update(id, { name: input.name });
    return toPublicOrganization(org, role);
  }

  async remove(id: string): Promise<void> {
    const org = await this.repo.findById(id);
    if (!org) throw new NotFoundException('Organization not found');
    await this.repo.softDelete(id);
  }
}
