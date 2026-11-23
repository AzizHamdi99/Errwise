import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../../common/security/jwt-auth.guard';
import { ORG_ROLES_KEY } from '../memberships/decorators/org-roles.decorator';
import { OrgMemberGuard } from '../memberships/guards/org-member.guard';
import { FixesController } from './fixes.controller';

describe('FixesController', () => {
  it('requires a logged-in member of the organization', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      FixesController,
    ) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, OrgMemberGuard]);
  });

  it('lets any member read and ask for a suggestion: it writes nothing', () => {
    for (const method of ['get', 'suggest'] as const) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const handler = FixesController.prototype[method];
      expect(Reflect.getMetadata(ORG_ROLES_KEY, handler)).toBeUndefined();
    }
  });

  it('lets only an owner or an admin open the pull request: it pushes a branch', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const handler = FixesController.prototype.openPullRequest;
    expect(Reflect.getMetadata(ORG_ROLES_KEY, handler)).toEqual([
      'owner',
      'admin',
    ]);
  });

  it('is at .../fix/:fixId/pull-request and takes nothing from the body', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const handler = FixesController.prototype.openPullRequest;
    expect(Reflect.getMetadata('path', handler)).toBe(':fixId/pull-request');
    // Only ids, taken from the URL: no @Body() parameter exists on this handler.
    const keys = Reflect.getMetadata(
      '__routeArguments__',
      FixesController,
      'openPullRequest',
    ) as Record<string, unknown> | undefined;
    const used = Object.keys(keys ?? {});
    // The three ids (route params, type 5) and the membership are found...
    expect(used.filter((k) => k.startsWith('5:'))).toHaveLength(3);
    // ...and none of them is the body (type 3).
    expect(used.some((k) => k.startsWith('3:'))).toBe(false);
  });
});
