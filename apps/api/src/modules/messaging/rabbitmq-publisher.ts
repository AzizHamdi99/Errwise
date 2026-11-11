import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { MESSAGES_EXCHANGE, messageSchemas } from '@errwise/shared';
import type { Env } from '../../config/env';
import { MessagePublisher, type OutgoingMessage } from './message-publisher';
import { assertTopology } from './topology';

@Injectable()
export class RabbitMqPublisher extends MessagePublisher {
  private readonly logger = new Logger(RabbitMqPublisher.name);
  private readonly url: string | undefined;
  private topologyReady = false;

  constructor(config: ConfigService<Env, true>) {
    super();
    this.url = config.get('RABBITMQ_URL', { infer: true });
  }

  /**
   * Opens a connection, publishes, closes. Serverless instances come and go and
   * the broker allows few connections, so we never keep one open.
   */
  async publish(messages: OutgoingMessage[]): Promise<void> {
    if (messages.length === 0) return;
    if (!this.url) {
      this.logger.error('RABBITMQ_URL is not set, alerts were not published');
      return;
    }

    let connection: Awaited<ReturnType<typeof amqp.connect>> | undefined;
    try {
      connection = await amqp.connect(this.url);
      const channel = await connection.createConfirmChannel();

      if (!this.topologyReady) {
        await assertTopology(channel);
        this.topologyReady = true;
      }

      for (const message of messages) {
        // Validates the contract before it leaves the process.
        const envelope = messageSchemas[message.type].parse({
          id: randomUUID(),
          type: message.type,
          version: 1,
          occurredAt: new Date().toISOString(),
          data: message.data,
        });
        channel.publish(
          MESSAGES_EXCHANGE,
          message.type,
          Buffer.from(JSON.stringify(envelope)),
          {
            persistent: true,
            contentType: 'application/json',
            messageId: envelope.id,
            type: message.type,
          },
        );
      }
      await channel.waitForConfirms(); // the broker confirmed it stored them
    } catch (error) {
      // Log without the payload.
      this.logger.error(
        `Could not publish ${messages.length} message(s)`,
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      await connection?.close().catch(() => undefined);
    }
  }
}
