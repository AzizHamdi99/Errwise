import { Module } from '@nestjs/common';
import { MessagePublisher } from './message-publisher';
import { RabbitMqPublisher } from './rabbitmq-publisher';

@Module({
  providers: [{ provide: MessagePublisher, useClass: RabbitMqPublisher }],
  exports: [MessagePublisher],
})
export class MessagingModule {}
