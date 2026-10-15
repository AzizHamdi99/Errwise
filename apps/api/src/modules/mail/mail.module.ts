import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { ConsoleMailService } from './console-mail.service';
import { MailService } from './mail.service';
import { ResendMailService } from './resend-mail.service';

@Module({
  providers: [
    {
      provide: MailService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): MailService => {
        const driver = config.get('MAIL_DRIVER', { infer: true });
        if (driver === 'resend') {
          return new ResendMailService(
            config.get('RESEND_API_KEY', { infer: true }) as string,
            config.get('MAIL_FROM', { infer: true }),
          );
        }
        return new ConsoleMailService();
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
