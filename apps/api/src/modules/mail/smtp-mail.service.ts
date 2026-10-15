import * as nodemailer from 'nodemailer';
import { MailMessage, MailService } from './mail.service';

export class SmtpMailService extends MailService {
  private readonly transporter: nodemailer.Transporter;

  constructor(
    options: { host: string; port: number; user: string; pass: string },
    private readonly from: string,
  ) {
    super();
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.port === 465,
      auth: { user: options.user, pass: options.pass },
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, ...message });
  }
}
