import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import type { PublicUser } from '@errwise/shared';
import { CreateUserData, UsersRepository } from './users.repository';
import { toPublicUser } from './users.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  async getById(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findById(id);
  }

  async getProfile(id: string): Promise<PublicUser> {
    return toPublicUser(await this.getById(id));
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repo.findByEmail(email);
  }

  async create(data: CreateUserData): Promise<User> {
    try {
      return await this.repo.create(data);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }
      throw e;
    }
  }

  touchLastLogin(id: string): Promise<User> {
    return this.repo.touchLastLogin(id);
  }
}
