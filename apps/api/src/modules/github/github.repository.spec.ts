import type { PrismaService } from '../../database/prisma.service';
import { GithubRepository } from './github.repository';

describe('GithubRepository.disconnect', () => {
  it('also switches source code access off: no repository, no consent to read it', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = { project: { update } } as unknown as PrismaService;

    await new GithubRepository(prisma).disconnect('p1');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        githubInstallationId: null,
        githubRepo: null,
        sourceContextEnabled: false,
      },
    });
  });
});
