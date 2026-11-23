import { Prisma } from '@prisma/client';

/** The fixes of one project, or of every project of an organization. */
export type FixScope = { projectId: string } | { organizationId: string };

function issuesOf(scope: FixScope): Prisma.IssueFixWhereInput {
  return 'projectId' in scope
    ? { issue: { projectId: scope.projectId } }
    : { issue: { project: { organizationId: scope.organizationId } } };
}

/**
 * Removes the customer's code from the fixes in `scope` (ADR-009). Run inside the same
 * transaction as the change that makes it necessary: a switch turned off, GitHub disconnected
 * or reselected, the project or organization deleted. The saving of a fix takes a lock on the
 * project row (FixesRepository.saveFix), so one of the two always runs entirely before the
 * other and a fix saved during the change is wiped with the rest.
 *
 * A fix without a pull request is deleted. One that has opened a pull request, or is opening
 * one right now, keeps its row and its link and loses its code.
 */
export async function wipeFixCode(
  tx: Prisma.TransactionClient,
  scope: FixScope,
): Promise<void> {
  const where = issuesOf(scope);
  await tx.issueFix.deleteMany({
    where: { ...where, prNumber: null, prClaimedAt: null },
  });
  await tx.issueFix.updateMany({
    where: {
      ...where,
      OR: [{ prNumber: { not: null } }, { prClaimedAt: { not: null } }],
    },
    data: { edits: Prisma.DbNull, result: {} },
  });
}
