/**
 * Measures the cost of ingesting one event (the whole transaction of IngestionRepository.store)
 * on an existing issue of the perf project. Run it before and after adding an index to "Issue":
 * every event updates its issue row, and each index of the table gets a new entry per update.
 *
 *   yarn workspace @errwise/api exec tsx scripts/perf/bench-ingest.ts [events] [rounds]
 *
 * It creates one throw-away issue (fingerprint prefix "verify-env-") and deletes it at the end.
 */
import { randomUUID } from 'node:crypto';
import { IngestionRepository } from '../../src/modules/ingestion/ingestion.repository';
import type { StoreEventData } from '../../src/modules/ingestion/ingestion.repository';
import { createPerfClient, PERF_PROJECT_SLUG } from './perf-guard';

const prisma = createPerfClient();
const repo = new IngestionRepository(prisma as never);

const EVENTS = Number(process.argv[2] ?? 300);
const ROUNDS = Number(process.argv[3] ?? 3);

async function main(): Promise<void> {
  const project = await prisma.project.findFirstOrThrow({
    where: { slug: PERF_PROJECT_SLUG },
  });
  const fingerprint = `verify-env-bench-${randomUUID()}`;
  // A title as long as a typical real one (type + message), since an index on title grows with it.
  const title =
    'TypeError: Cannot read properties of undefined (reading "id") at checkout';
  const event = (): StoreEventData => ({
    projectId: project.id,
    fingerprint,
    fingerprintVersion: 1,
    title,
    eventId: randomUUID(),
    level: 'error',
    type: 'TypeError',
    message: 'bench',
    platform: 'node',
    environment: 'production',
    timestamp: new Date(),
  });

  await repo.store(event()); // creates the issue and warms the connection
  const results: number[] = [];
  for (let round = 0; round < ROUNDS; round++) {
    const start = performance.now();
    for (let i = 0; i < EVENTS; i++) await repo.store(event());
    results.push((performance.now() - start) / EVENTS);
  }
  console.log(
    `store() per event over ${ROUNDS} rounds of ${EVENTS}: ` +
      results.map((ms) => `${ms.toFixed(2)} ms`).join(', ') +
      `  (median ${[...results].sort((a, b) => a - b)[Math.floor(results.length / 2)].toFixed(2)} ms)`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const project = await prisma.project.findFirst({
      where: { slug: PERF_PROJECT_SLUG },
    });
    if (project) {
      await prisma.issue.deleteMany({
        where: {
          projectId: project.id,
          fingerprint: { startsWith: 'verify-env-' },
        },
      });
    }
    await prisma.$disconnect();
  });
