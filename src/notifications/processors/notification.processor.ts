import { Process, Processor, OnQueueFailed, OnQueueCompleted } from '@nestjs/bull';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bull';
import { NOTIFICATION_QUEUE, EMAIL_NOTIFICATION_JOB, SMS_NOTIFICATION_JOB } from '../../queue/queue.constants';
import { MailService } from '../../shared/mail/mail.service';
import { SmsService } from '../../shared/sms/sms.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';

export interface EmailNotificationJobData {
  userId: string;
  to: string;
  template: string;
  subject: string;
  variables: Record<string, string>;
}

export interface SmsNotificationJobData {
  userId: string;
  phoneNumber: string;
  message: string;
}

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly mailService: MailService,
    @Optional() private readonly smsService: SmsService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  @Process(EMAIL_NOTIFICATION_JOB)
  async handleEmailNotification(job: Job<EmailNotificationJobData>) {
    const { to, template, subject, variables } = job.data;
    this.logger.log(`Processing email job ${job.id} for ${to} (template: ${template})`);

    const html = await this.mailService.renderTemplate(template, variables);
    const result = await this.mailService.sendMail({ to, subject, html });

    if (!result.success) {
      throw new Error(`Email delivery failed: ${result.error}`);
    }

    return { delivered: true, messageId: result.messageId };
  }

  @Process(SMS_NOTIFICATION_JOB)
  async handleSmsNotification(job: Job<SmsNotificationJobData>) {
    const { phoneNumber, message } = job.data;
    this.logger.log(`Processing SMS job ${job.id} for ${phoneNumber}`);

    if (!this.smsService) {
      throw new Error('SMS service not configured - Twilio credentials missing');
    }

    await this.smsService.sendSms(phoneNumber, message);
    return { delivered: true };
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `Notification job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempt(s): ${error.message}`
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Notification job ${job.id} (${job.name}) completed:`, result);
  }
}
