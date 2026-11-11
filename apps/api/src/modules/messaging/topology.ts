import type { ConfirmChannel } from 'amqplib';
import { MESSAGES_EXCHANGE, QUEUES } from '@errwise/shared';

const RETRY_DELAY_MS = 30_000;

/**
 * Idempotent. Both the API and the worker call it, so a message is never
 * dropped just because no queue exists yet.
 */
export async function assertTopology(channel: ConfirmChannel): Promise<void> {
  await channel.assertExchange(MESSAGES_EXCHANGE, 'topic', { durable: true });

  for (const queue of Object.values(QUEUES)) {
    const { name } = queue;

    // Messages that fail for good end up here.
    await channel.assertQueue(`${name}.dlq`, { durable: true });

    await channel.assertQueue(name, {
      durable: true,
      deadLetterExchange: '', // default exchange: routes by queue name
      deadLetterRoutingKey: `${name}.dlq`,
    });

    // Waits, then returns to the main queue (used by the retry logic in step 6).
    await channel.assertQueue(`${name}.retry`, {
      durable: true,
      messageTtl: RETRY_DELAY_MS,
      deadLetterExchange: '',
      deadLetterRoutingKey: name,
    });

    for (const key of queue.bindings) {
      await channel.bindQueue(name, MESSAGES_EXCHANGE, key);
    }
  }
}
