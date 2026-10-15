import { Logger } from '@nestjs/common';
import { MailMessage, MailService } from './mail.service';

/** Development driver: prints the email (and its link) in the terminal. */
export class ConsoleMailService extends MailService {
  private readonly logger = new Logger('Mail');

  send(message: MailMessage): Promise<void> {
    this.logger.log(
      `To: ${message.to}\nSubject: ${message.subject}\n${message.text}`,
    );
    return Promise.resolve();
  }
}
