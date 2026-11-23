/**
 * Checks the storage rules of AI fixes (ADR-009) against the real local database, with the real
 * repositories:
 *  - a fix is stored once per input, and refused when the project no longer allows it;
 *  - turning source code or fixes off, disconnecting GitHub, choosing another repository and
 *    deleting the project or the organization remove the code of the fixes in the same
 *    transaction, and keep the pull request link of a fix that has one;
 *  - a save that runs at the same moment as a switch being turned off never leaves code behind,
 *    in either order (a deterministic case with a lock held on purpose, then a real race);
 *  - eight saves of the same input at once store one row;
 *  - the right to open a pull request: eight claims at once give one winner, a dead claim is
 *    taken over, the settings are part of the claim, a request in flight can tell that consent
 *    was withdrawn, one pull request belongs to one fix, and no claim crosses a tenant.
 * It creates throw-away organizations (slug prefix "verify-fix-") and deletes them at the end.
 * It refuses to run unless DATABASE_URL points to localhost.
 *
 *   yarn workspace @errwise/api exec tsx --env-file=.env scripts/verify-fix-wipe.ts
 */
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { FixesRepository } from '../src/modules/fixes/fixes.repository';
import type { SaveFixData } from '../src/modules/fixes/fixes.repository';
import { GithubRepository } from '../src/modules/github/github.repository';
import { OrganizationsRepository } from '../src/modules/organizations/organizations.repository';
import { ProjectsRepository } from '../src/modules/projects/projects.repository';
import { createPerfClient } from './perf/perf-guard';

const prisma = createPerfClient();
const fixes = new FixesRepository(prisma as never);
const projects = new ProjectsRepository(prisma as never);
const github = new GithubRepository(prisma as never);
const organizations = new OrganizationsRepository(prisma as never);

const PREFIX = 'verify-fix-';
const RACE_ROUNDS = 120;
let failed = false;

function check(ok: boolean, text: string): void {
  if (!ok) failed = true;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${text}`);
}

// A pull request number belongs to one row (unique per repository), so each use gets its own.
let nextPullRequest = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface World {
  organizationId: string;
  projectId: string;
  issueId: string;
}

async function seed(): Promise<World> {
  const organization = await prisma.organization.create({
    data: { name: 'Verify fixes', slug: `${PREFIX}${randomUUID()}` },
  });
  const project = await prisma.project.create({
    data: {
      organizationId: organization.id,
      name: 'Shop',
      slug: 'shop',
      sourceContextEnabled: true,
      fixPullRequestsEnabled: true,
      githubInstallationId: '77',
      githubRepo: 'acme/shop',
    },
  });
  const now = new Date();
  const issue = await prisma.issue.create({
    data: {
      projectId: project.id,
      fingerprint: randomUUID(),
      title: 'TypeError: boom',
      firstSeenAt: now,
      lastSeenAt: now,
    },
  });
  return {
    organizationId: organization.id,
    projectId: project.id,
    issueId: issue.id,
  };
}

function data(world: World, inputHash = 'hash-1'): SaveFixData {
  return {
    ...world,
    inputHash,
    promptVersion: 'fix-v1',
    model: 'test-model',
    repo: 'acme/shop',
    installationId: '77',
    commitSha: 'a'.repeat(40),
    result: {
      fixable: true,
      prTitle: 'Handle a missing user',
      explanation: 'It can be null.',
      confidence: 'high',
      reason: '',
      files: ['src/users.js:3'],
      warnings: [],
      promptVersion: 'fix-v1',
      model: 'test-model',
    },
    edits: [
      {
        file: 'src/users.js',
        search: 'user.profile.name',
        replace: 'user?.profile.name',
        line: 3,
        prefix: '  return ',
        suffix: ';',
      },
    ],
  };
}

const count = (world: World) =>
  prisma.issueFix.count({ where: { issueId: world.issueId } });

const rowsWithCode = (world: World) =>
  prisma.issueFix.count({
    where: { issueId: world.issueId, edits: { not: Prisma.DbNull } },
  });

async function setSwitches(
  world: World,
  values: { sourceContextEnabled: boolean; fixPullRequestsEnabled: boolean },
) {
  await prisma.project.update({ where: { id: world.projectId }, data: values });
}

/** Marks a stored fix as having opened a pull request, and returns its number. */
async function openPullRequest(world: World, inputHash = 'hash-1') {
  const number = nextPullRequest++;
  await prisma.issueFix.update({
    where: {
      issueId_inputHash: { issueId: world.issueId, inputHash },
    },
    data: {
      prNumber: number,
      prUrl: `https://github.com/acme/shop/pull/${number}`,
    },
  });
  return number;
}

async function cleanup(): Promise<void> {
  await prisma.organization.deleteMany({
    where: { slug: { startsWith: PREFIX } },
  });
}

async function main(): Promise<void> {
  await cleanup();

  // --- storing ----------------------------------------------------------------------------
  {
    const world = await seed();
    const first = await fixes.saveFix(data(world));
    check(
      first.status === 'saved' && first.created,
      'a fix is stored when the project allows it',
    );

    const again = await fixes.saveFix(data(world));
    check(
      again.status === 'saved' &&
        !again.created &&
        first.status === 'saved' &&
        again.fix.id === first.fix.id &&
        (await count(world)) === 1,
      'the same input again returns the stored row, no second one',
    );

    const other = await fixes.saveFix(data(world, 'hash-2'));
    check(
      other.status === 'saved' && (await count(world)) === 2,
      'another input is another row',
    );

    for (const [name, change] of [
      ['another repository', { repo: 'acme/other' }],
      ['another installation', { installationId: '78' }],
      ['another organization', { organizationId: randomUUID() }],
    ] as const) {
      const out = await fixes.saveFix({
        ...data(world, `x-${name}`),
        ...change,
      });
      check(out.status === 'project_changed', `a fix for ${name} is refused`);
    }
    const sameRepoOtherCase = await fixes.saveFix({
      ...data(world, 'case'),
      repo: 'ACME/Shop',
    });
    check(
      sameRepoOtherCase.status === 'saved',
      'the repository name is compared without case, like GitHub does',
    );
  }

  // --- switches ---------------------------------------------------------------------------
  for (const [label, update] of [
    ['source code', { sourceContextEnabled: false }],
    ['AI fixes', { fixPullRequestsEnabled: false }],
  ] as const) {
    const world = await seed();
    await fixes.saveFix(data(world));
    await projects.update(world.projectId, update);

    check((await count(world)) === 0, `turning ${label} off deletes the fix`);
    const refused = await fixes.saveFix(data(world));
    check(
      refused.status === 'project_changed' && (await count(world)) === 0,
      `and a new fix is refused while ${label} is off`,
    );
  }

  {
    const world = await seed();
    await fixes.saveFix(data(world));
    await projects.update(world.projectId, { sourceContextEnabled: true });
    check(
      (await count(world)) === 1,
      'saving the project with source code still on keeps the fixes',
    );
    await projects.update(world.projectId, { name: 'Renamed' });
    check((await count(world)) === 1, 'so does an unrelated change');
  }

  // --- a fix with a pull request -----------------------------------------------------------
  {
    const world = await seed();
    const saved = await fixes.saveFix(data(world));
    const pr = await openPullRequest(world);
    await projects.update(world.projectId, { sourceContextEnabled: false });

    const row = await prisma.issueFix.findFirst({
      where: { issueId: world.issueId },
    });
    check(row !== null, 'a fix with a pull request keeps its row');
    check(
      row?.edits === null && JSON.stringify(row?.result) === '{}',
      'but loses its code and its text',
    );
    check(
      row?.prNumber === pr && row?.prUrl?.endsWith(`/pull/${pr}`) === true,
      'and keeps the link to the pull request',
    );

    await setSwitches(world, {
      sourceContextEnabled: true,
      fixPullRequestsEnabled: true,
    });
    const restored = await fixes.saveFix(data(world));
    check(
      restored.status === 'saved' &&
        saved.status === 'saved' &&
        restored.created &&
        restored.fix.id === saved.fix.id &&
        restored.fix.edits !== null &&
        restored.fix.prNumber === pr,
      'the same input gives that row its code back, link included',
    );
  }

  // --- GitHub -----------------------------------------------------------------------------
  {
    const world = await seed();
    await fixes.saveFix(data(world));
    await github.disconnect(world.projectId);
    const project = await prisma.project.findUniqueOrThrow({
      where: { id: world.projectId },
    });
    check((await count(world)) === 0, 'disconnecting GitHub deletes the fix');
    check(
      !project.sourceContextEnabled &&
        !project.fixPullRequestsEnabled &&
        project.githubRepo === null,
      'and turns both switches off',
    );
  }
  {
    const world = await seed();
    await fixes.saveFix(data(world));
    await github.saveRepo(world.projectId, 'acme/other');
    check(
      (await count(world)) === 0,
      'choosing another repository deletes the fix',
    );
  }
  {
    const world = await seed();
    await fixes.saveFix(data(world));
    await github.saveInstallation(world.projectId, '99');
    check((await count(world)) === 0, 'a new installation deletes the fix');
  }

  // --- deleting ---------------------------------------------------------------------------
  {
    const world = await seed();
    await fixes.saveFix(data(world));
    await fixes.saveFix(data(world, 'hash-2'));
    const prNumber = await openPullRequest(world, 'hash-2');
    await projects.softDelete(world.projectId);
    const left = await prisma.issueFix.findMany({
      where: { issueId: world.issueId },
    });
    check(
      left.length === 1 &&
        left[0].edits === null &&
        left[0].prNumber === prNumber,
      'deleting the project removes the code of its fixes',
    );
    const refused = await fixes.saveFix(data(world, 'hash-3'));
    check(
      refused.status === 'project_changed',
      'and no fix is stored for it any more',
    );
  }
  {
    const world = await seed();
    await fixes.saveFix(data(world));
    await organizations.softDelete(world.organizationId);
    check(
      (await count(world)) === 0,
      'deleting the organization removes them too',
    );
  }

  // --- the lock: a save that is running while a switch is turned off -------------------------
  {
    const world = await seed();
    const holdMs = 600;
    const delayMs = 150;
    let lockTaken = 0;

    // What saveFix does, but slow: the lock is taken, the row is written a moment later.
    const slowSave = prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT 1 FROM "Project" WHERE "id" = ${world.projectId}::uuid FOR SHARE`,
      );
      lockTaken = Date.now();
      await sleep(holdMs);
      const base = data(world);
      await tx.issueFix.create({
        data: {
          issueId: world.issueId,
          inputHash: 'slow',
          promptVersion: base.promptVersion,
          model: base.model,
          repo: base.repo,
          installationId: base.installationId,
          commitSha: base.commitSha,
          result: base.result,
          edits: base.edits,
        },
      });
    });

    await sleep(delayMs);
    check(lockTaken > 0, 'the slow save holds its lock');
    const started = Date.now();
    await projects.update(world.projectId, { fixPullRequestsEnabled: false });
    const waited = Date.now() - started;
    await slowSave;

    check(
      waited >= holdMs - delayMs - 100,
      `turning the switch off waited for the save (${waited} ms)`,
    );
    check(
      (await count(world)) === 0,
      'and then wiped the row the save wrote: no code survives',
    );
  }

  // --- a real race, many times ----------------------------------------------------------------
  {
    let saved = 0;
    let refused = 0;
    let leftBehind = 0;
    for (let round = 0; round < RACE_ROUNDS; round++) {
      const world = await seed();
      // A random head start for either side, so both orders happen.
      const [outcome] = await Promise.all([
        sleep(Math.random() * 12).then(() => fixes.saveFix(data(world))),
        sleep(Math.random() * 12).then(() =>
          projects.update(world.projectId, { fixPullRequestsEnabled: false }),
        ),
      ]);
      if (outcome.status === 'saved') saved += 1;
      else refused += 1;
      leftBehind += await rowsWithCode(world);
    }
    check(
      saved > 0 && refused > 0,
      `both orders happened (${saved} saved first, ${refused} switch-off first)`,
    );
    check(
      leftBehind === 0,
      `${RACE_ROUNDS} saves racing a switch-off left no code behind (${saved} saved then wiped, ${refused} refused)`,
    );
  }

  // --- claiming the right to open a pull request ---------------------------------------------
  {
    const world = await seed();
    const saved = await fixes.saveFix(data(world));
    const id = saved.status === 'saved' ? saved.fix.id : '';
    const longAgo = new Date(Date.now() - 120_000);
    const stale = new Date(Date.now() - 60_000);

    const claims = await Promise.all(
      Array.from({ length: 8 }, () => fixes.claimPullRequest(id, stale)),
    );
    check(
      claims.filter(Boolean).length === 1,
      'eight claims at once: exactly one wins',
    );
    check(
      !(await fixes.claimPullRequest(id, stale)),
      'a claim that is held cannot be taken again',
    );
    check(
      await fixes.isStillOpenable(id),
      'a claimed fix of a project that allows it is still openable',
    );

    await prisma.issueFix.update({
      where: { id },
      data: { prClaimedAt: longAgo },
    });
    check(
      await fixes.claimPullRequest(id, stale),
      'a claim older than the limit (a request that died) is taken over',
    );

    await fixes.releasePullRequestClaim(id);
    check(
      (await prisma.issueFix.findUniqueOrThrow({ where: { id } }))
        .prClaimedAt === null,
      'releasing a claim clears it',
    );
    check(
      !(await fixes.isStillOpenable(id)),
      'an unclaimed fix is not "still openable"',
    );
    check(
      await fixes.claimPullRequest(id, stale),
      'and it can be claimed again',
    );

    const first = await fixes.savePullRequest(id, {
      number: nextPullRequest++,
      url: 'https://github.com/acme/shop/pull/200',
      userId: (
        await prisma.user.create({
          data: { email: `${PREFIX}${randomUUID()}@example.test` },
        })
      ).id,
    });
    check(
      first.saved &&
        first.fix.prNumber !== null &&
        first.fix.prClaimedAt === null &&
        first.fix.prOpenedById !== null,
      'saving the link records the pull request and the person, and ends the claim',
    );
    const before = first.fix.prNumber;
    const second = await fixes.savePullRequest(id, {
      number: nextPullRequest++,
      url: 'https://github.com/acme/shop/pull/201',
      userId: first.fix.prOpenedById as string,
    });
    check(
      !second.saved && second.fix.prNumber === before,
      'a second save does not overwrite the first, and says so (so the audit entry is written once)',
    );
    check(
      !(await fixes.claimPullRequest(id, stale)),
      'a fix with a pull request cannot be claimed again',
    );

    // One pull request belongs to one fix.
    const other = await fixes.saveFix(data(world, 'hash-other'));
    const otherId = other.status === 'saved' ? other.fix.id : '';
    let duplicate = false;
    try {
      await fixes.savePullRequest(otherId, {
        number: before as number,
        url: 'https://github.com/acme/shop/pull/x',
        userId: first.fix.prOpenedById as string,
      });
    } catch (error) {
      duplicate =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002';
    }
    check(
      duplicate,
      'the same pull request number cannot be saved for two fixes',
    );
    await prisma.user.deleteMany({
      where: { email: { startsWith: PREFIX } },
    });
  }

  for (const [label, change] of [
    ['AI fixes are turned off', { fixPullRequestsEnabled: false }],
    ['source code is turned off', { sourceContextEnabled: false }],
  ] as const) {
    const world = await seed();
    const saved = await fixes.saveFix(data(world));
    const id = saved.status === 'saved' ? saved.fix.id : '';
    await fixes.claimPullRequest(id, new Date(Date.now() - 60_000));
    await projects.update(world.projectId, change);

    const row = await prisma.issueFix.findUnique({ where: { id } });
    check(
      row !== null && row.edits === null && row.prClaimedAt !== null,
      `a claimed fix survives, without its code, when ${label}`,
    );
    check(
      !(await fixes.isStillOpenable(id)),
      `and is no longer openable: the request in flight stops before pushing`,
    );
    await setSwitches(world, {
      sourceContextEnabled: true,
      fixPullRequestsEnabled: true,
    });
    check(
      !(await fixes.claimPullRequest(id, new Date(Date.now() - 60_000))),
      'a fix without code cannot be claimed, even when the switches are back on',
    );
  }

  for (const [label, run] of [
    ['the project is deleted', (w: World) => projects.softDelete(w.projectId)],
    [
      'the organization is deleted',
      (w: World) => organizations.softDelete(w.organizationId),
    ],
  ] as const) {
    const world = await seed();
    const saved = await fixes.saveFix(data(world));
    const id = saved.status === 'saved' ? saved.fix.id : '';
    await run(world);
    check(
      !(await fixes.claimPullRequest(id, new Date(Date.now() - 60_000))),
      `nothing can be claimed when ${label}`,
    );
  }

  {
    const world = await seed();
    const other = await seed();
    const saved = await fixes.saveFix(data(world));
    const id = saved.status === 'saved' ? saved.fix.id : '';
    const found = await fixes.findFixInProject(
      world.organizationId,
      world.projectId,
      world.issueId,
      id,
    );
    check(
      found?.id === id && found.issue.id === world.issueId,
      'a fix is found in its own organization, project and issue',
    );
    const misses = await Promise.all([
      fixes.findFixInProject(
        other.organizationId,
        world.projectId,
        world.issueId,
        id,
      ),
      fixes.findFixInProject(
        world.organizationId,
        other.projectId,
        world.issueId,
        id,
      ),
      fixes.findFixInProject(
        world.organizationId,
        world.projectId,
        other.issueId,
        id,
      ),
    ]);
    check(
      misses.every((m) => m === null),
      'and not through another organization, project or issue',
    );
  }

  // --- the same input at once -------------------------------------------------------------------
  {
    const world = await seed();
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () => fixes.saveFix(data(world))),
    );
    const created = outcomes.filter(
      (o) => o.status === 'saved' && o.created,
    ).length;
    check(
      created === 1 && (await count(world)) === 1,
      'eight saves of the same input at once store one row, and one reports it created',
    );
  }
}

main()
  .catch((error: unknown) => {
    failed = true;
    console.error(error);
  })
  .finally(async () => {
    await cleanup();
    await prisma.$disconnect();
    console.log(failed ? '\nSOME CHECKS FAILED' : '\nall checks passed');
    process.exit(failed ? 1 : 0);
  });
