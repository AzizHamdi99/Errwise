export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export abstract class MailService {
  abstract send(message: MailMessage): Promise<void>;
}
