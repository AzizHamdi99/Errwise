import { Logger } from '@nestjs/common';
import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { messageSchemas } from '@errwise/shared';
import type { Message, MessageType } from '@errwise/shared';
import type { Env } from '../../config/env';
import { assertTopology } from './topology';

const MAX_ATTEMPTS = 3;
const PREFETCH = 5;

type Connection = Awaited<ReturnType<typeof amqp.connect>>;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Base class for every queue consumer. It owns the connection, validation,
 * retries and shutdown, so a consumer only implements `handle`.
 */
export abstract class QueueConsumer
  implements OnApplicationBootstrap, OnModuleDestroy
{
  protected abstract readonly queue: string;
  protected readonly logger = new Logger(this.constructor.name);

  private connection?: Connection;
  private channel?: ConfirmChannel;
  private consumerTag?: string;
  private closing = false;
  private readonly inFlight = new Set<Promise<void>>();

  protected constructor(private readonly config: ConfigService<Env, true>) {}

  /** Return to acknowledge the message. Throw to retry it later. */
  protected abstract handle(message: Message): Promise<void>;

  async onApplicationBootstrap(): Promise<void> {
    const url = this.config.get('RABBITMQ_URL', { infer: true });
    if (!url) throw new Error('RABBITMQ_URL is required to run the worker');
    const connection = await amqp.connect(url);
    this.connection = connection;
    connection.on('error', (error: Error) =>
      this.logger.error(`RabbitMQ error: ${error.message}`),
    );
    connection.on('close', () => {
      if (this.closing) return;
      // Let the process manager (Docker, systemd) restart the worker.
      this.logger.error('RabbitMQ connection closed, exiting');
      process.exit(1);
    });

    const channel = await connection.createConfirmChannel();
    this.channel = channel;
    await assertTopology(channel);
    await channel.prefetch(PREFETCH);

    const { consumerTag } = await channel.consume(this.queue, (msg) => {
      if (!msg) return; // the broker cancelled this consumer
      const task: Promise<void> = this.process(channel, msg).finally(() => {
        this.inFlight.delete(task);
      });
      this.inFlight.add(task);
    });
    this.consumerTag = consumerTag;
    this.logger.log(`Consuming ${this.queue}`);
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;
    try {
      if (this.channel && this.consumerTag) {
        await this.channel.cancel(this.consumerTag); // stop receiving
      }
      await Promise.allSettled([...this.inFlight]); // let running handlers finish
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      this.logger.warn(`Shutdown problem: ${errorText(error)}`);
    }
  }

  private async process(
    channel: ConfirmChannel,
    msg: ConsumeMessage,
  ): Promise<void> {
    try {
      const message = this.parse(msg);
      if (!message) {
        // A malformed message can never succeed: no retry.
        await this.moveTo(channel, msg, `${this.queue}.dlq`, {
          'x-error': 'invalid message',
        });
        return;
      }
      try {
        await this.handle(message);
        channel.ack(msg);
      } catch (error) {
        await this.fail(channel, msg, message.id, error);
      }
    } catch (error) {
      // Not acked: the broker redelivers it when the channel closes.
      this.logger.error(`Could not settle a message: ${errorText(error)}`);
    }
  }

  private parse(msg: ConsumeMessage): Message | null {
    try {
      const body: unknown = JSON.parse(msg.content.toString('utf8'));
      const type = (body as { type?: unknown }).type;
      if (typeof type !== 'string' || !(type in messageSchemas)) {
        throw new Error('unknown message type');
      }
      return messageSchemas[type as MessageType].parse(body);
    } catch (error) {
      this.logger.error(`Invalid message: ${errorText(error)}`);
      return null;
    }
  }

  private async fail(
    channel: ConfirmChannel,
    msg: ConsumeMessage,
    id: string,
    error: unknown,
  ): Promise<void> {
    const headers = msg.properties.headers;
    const previous = headers?.['x-attempts'];
    const attempts = (typeof previous === 'number' ? previous : 0) + 1;
    const reason = errorText(error);

    if (attempts >= MAX_ATTEMPTS) {
      this.logger.error(
        `Message ${id} failed ${attempts} times, moved to the dead-letter queue: ${reason}`,
      );
      await this.moveTo(channel, msg, `${this.queue}.dlq`, {
        'x-attempts': attempts,
        'x-error': reason.slice(0, 500),
      });
      return;
    }
    this.logger.warn(
      `Message ${id} failed (attempt ${attempts}/${MAX_ATTEMPTS}), retrying later: ${reason}`,
    );
    await this.moveTo(channel, msg, `${this.queue}.retry`, {
      'x-attempts': attempts,
    });
  }

  /** Copies the message to another queue, waits for the broker's confirm, then acks the original. */
  private async moveTo(
    channel: ConfirmChannel,
    msg: ConsumeMessage,
    queue: string,
    extraHeaders: Record<string, unknown>,
  ): Promise<void> {
    const { messageId, type } = msg.properties as {
      messageId?: string;
      type?: string;
    };
    channel.sendToQueue(queue, msg.content, {
      persistent: true,
      contentType: 'application/json',
      messageId,
      type,
      headers: {
        ...msg.properties.headers,
        ...extraHeaders,
      },
    });
    await channel.waitForConfirms();
    channel.ack(msg);
  }
}
