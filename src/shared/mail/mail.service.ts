import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface MailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter | null = null;
  private readonly templatesDir: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    this.templatesDir = join(__dirname, '..', 'shared', 'mail', 'templates');

    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
      });
      this.logger.log(`SMTP transport configured: ${host}:${port}`);
    } else {
      this.logger.warn(
        'SMTP_HOST not configured — emails will be logged to console instead of delivered'
      );
    }
  }

  async sendMail(options: SendMailOptions): Promise<MailResult> {
    const from =
      this.configService.get<string>('SMTP_FROM') || 'noreply@vitastellar.com';

    if (!this.transporter) {
      this.logger.log(
        `[DRY-RUN] Email to ${options.to} — subject: "${options.subject}"\n` +
          options.html.substring(0, 200) + '...'
      );
      return { success: true, messageId: 'dry-run' };
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      this.logger.log(`Email sent to ${options.to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown mail error';
      this.logger.error(`Failed to send email to ${options.to}: ${message}`);
      return { success: false, error: message };
    }
  }

  async renderTemplate(templateName: string, variables: Record<string, string>): Promise<string> {
    const templatePath = join(this.templatesDir, `${templateName}.html`);
    try {
      let html = await fs.readFile(templatePath, 'utf-8');
      for (const [key, value] of Object.entries(variables)) {
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
      return html;
    } catch {
      this.logger.warn(`Template ${templateName} not found, using fallback`);
      return `<p>${variables.message || 'No message provided'}</p>`;
    }
  }
}
