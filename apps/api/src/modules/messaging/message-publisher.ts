import type { Message, MessageType } from '@errwise/shared';

/** A message to publish: its type and its data. The envelope is added by the publisher. */
export type OutgoingMessage = {
  [T in MessageType]: { type: T; data: Message<T>['data'] };
}[MessageType];

export abstract class MessagePublisher {
  /** Never throws: a broker problem must not break the caller. */
  abstract publish(messages: OutgoingMessage[]): Promise<void>;
}
