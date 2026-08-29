import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Job } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NOTIFICATION_QUEUE,
  EMAIL_NOTIFICATION_JOB,
  PUSH_NOTIFICATION_JOB,
  SMS_NOTIFICATION_JOB,
  TASK_REMINDER_JOB,
  TASK_REMINDER_TEMPLATE,
  REWARD_DEAD_LETTER_QUEUE,
} from '../../queue/queue.constants';
import { NotificationService } from '../services/notification.service';
import { Consultation } from '../../modules/consultations/entities/consultation.entity';
import { Notification } from '../entities/notification.entity';
import { User } from '../../entities/user.entity';

export interface EmailNotificationJobData {
  userId: string;
  consultationId?: string;
  scheduledAt?: string;
  template?: string;
  data?: Record<string, any>;
  to?: string;
  subject?: string;
  body?: string;
}

export interface PushNotificationJobData {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface SmsNotificationJobData {
  userId: string;
  message: string;
  phoneNumber?: string;
}

export interface TaskReminderJobData {
  userId: string;
  taskId: string;
  taskTitle: string;
  template?: string;
  remindAt?: Date | string;
}

@Processor(NOTIFICATION_QUEUE)
@Injectable()
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
    @Optional() @InjectQueue(REWARD_DEAD_LETTER_QUEUE) private readonly dlq?: Queue,
    @Optional()
    @InjectRepository(Consultation)
    private readonly consultationRepository?: Repository<Consultation>,
    @Optional()
    @InjectRepository(Notification)
    private readonly notificationRepository?: Repository<Notification>,
    @Optional()
    @InjectRepository(User)
    private readonly userRepository?: Repository<User>
  ) {}

  @Process(EMAIL_NOTIFICATION_JOB)
  async handleEmailNotification(
    job: Job<EmailNotificationJobData>
  ): Promise<{ delivered: boolean; reason?: string; userId?: string }> {
    this.logger.log(`Processing email notification job ${job.id} for user ${job.data?.userId}`);
    const { userId, consultationId, scheduledAt, template, data, subject, body } = job.data;

    if (!userId) {
      throw new Error(`Email notification job ${job.id} missing userId`);
    }

    // 1. Preference gating
    const canSend = await this.notificationService.canSendNotification(userId, 'email');
    if (!canSend) {
      this.logger.debug(
        `Email notifications disabled for user ${userId}. Skipping reminder job ${job.id}.`
      );
      return { delivered: false, reason: 'preferences_disabled', userId };
    }

    // 2. Consultation status and late-execution checks
    if (consultationId) {
      if (this.consultationRepository) {
        const consultation = await this.consultationRepository.findOne({
          where: { id: consultationId },
        });

        if (consultation && consultation.cancelled) {
          this.logger.log(
            `Consultation ${consultationId} is cancelled. Skipping reminder for job ${job.id}.`
          );
          return { delivered: false, reason: 'consultation_cancelled', userId };
        }
      }

      // Late execution guard: if the consultation scheduled time has already passed, skip
      if (scheduledAt) {
        const scheduledTime = new Date(scheduledAt).getTime();
        if (scheduledTime <= Date.now()) {
          this.logger.warn(
            `Consultation reminder for ${consultationId} fired after scheduled time (${scheduledAt}). Skipping late reminder.`
          );
          return { delivered: false, reason: 'consultation_past', userId };
        }
      }
    }

    // 3. Deliver email notification
    const emailTemplate =
      template || (consultationId ? 'consultation-reminder' : 'general-notification');
    const emailData = data || { consultationId, scheduledAt };

    const sent = await this.notificationService.sendEmail(userId, emailTemplate, emailData);
    if (!sent) {
      this.logger.debug(`Email sending suppressed for user ${userId}.`);
      return { delivered: false, reason: 'suppressed', userId };
    }

    // 4. Create in-app notification record
    const notifTitle = subject || (consultationId ? 'Consultation Reminder' : 'Notification');
    const notifBody =
      body ||
      (consultationId
        ? `Reminder: Your consultation is scheduled for ${
            scheduledAt ? new Date(scheduledAt).toUTCString() : 'soon'
          }.`
        : 'You have a new notification.');

    await this.notificationService.createNotification({
      userId,
      type: 'email',
      title: notifTitle,
      body: notifBody,
    });

    this.logger.log(
      `Email notification delivered successfully for job ${job.id} to user ${userId}`
    );
    return { delivered: true, userId };
  }

  @Process(PUSH_NOTIFICATION_JOB)
  async handlePushNotification(
    job: Job<PushNotificationJobData>
  ): Promise<{ delivered: boolean; reason?: string; userId?: string }> {
    this.logger.log(`Processing push notification job ${job.id} for user ${job.data?.userId}`);
    const { userId, title, body } = job.data;

    if (!userId) {
      throw new Error(`Push notification job ${job.id} missing userId`);
    }

    const canSend = await this.notificationService.canSendNotification(userId, 'push');
    if (!canSend) {
      this.logger.debug(`Push notifications disabled for user ${userId}. Skipping job ${job.id}.`);
      return { delivered: false, reason: 'preferences_disabled', userId };
    }

    const sent = await this.notificationService.sendPush(userId, title, body);
    if (!sent) {
      throw new Error(`Failed to deliver push notification to user ${userId}`);
    }

    this.logger.log(
      `Push notification delivered successfully for job ${job.id} to user ${userId}`
    );
    return { delivered: true, userId };
  }

  @Process(SMS_NOTIFICATION_JOB)
  async handleSmsNotification(
    job: Job<SmsNotificationJobData>
  ): Promise<{ delivered: boolean; reason?: string; userId?: string }> {
    this.logger.log(`Processing SMS notification job ${job.id} for user ${job.data?.userId}`);
    const { userId, message } = job.data;

    if (!userId) {
      throw new Error(`SMS notification job ${job.id} missing userId`);
    }

    const canSend = await this.notificationService.canSendNotification(userId, 'sms');
    if (!canSend) {
      this.logger.debug(`SMS notifications disabled for user ${userId}. Skipping job ${job.id}.`);
      return { delivered: false, reason: 'preferences_disabled', userId };
    }

    const sent = await this.notificationService.sendSMS(userId, message);
    if (!sent) {
      throw new Error(`Failed to deliver SMS to user ${userId}`);
    }

    await this.notificationService.createNotification({
      userId,
      type: 'sms',
      title: 'SMS Notification',
      body: message,
    });

    this.logger.log(`SMS notification delivered successfully for job ${job.id} to user ${userId}`);
    return { delivered: true, userId };
  }

  @Process(TASK_REMINDER_JOB)
  async handleTaskReminder(
    job: Job<TaskReminderJobData>
  ): Promise<{ delivered: boolean; reason?: string; userId?: string; taskId?: string }> {
    this.logger.log(`Processing task reminder job ${job.id} for user ${job.data?.userId}`);
    const { userId, taskId, taskTitle, template, remindAt } = job.data;

    if (!userId) {
      throw new Error(`Task reminder job ${job.id} missing userId`);
    }

    const prefs = await this.notificationService.getUserPreferences(userId);
    if (prefs && prefs.taskReminders === false) {
      this.logger.debug(`Task reminders disabled for user ${userId}. Skipping job ${job.id}.`);
      return { delivered: false, reason: 'preferences_disabled', userId };
    }

    const title = 'Task Reminder';
    const body = `Reminder: "${taskTitle || 'Your task'}" is scheduled for ${
      remindAt ? new Date(remindAt).toISOString() : 'now'
    }.`;

    await this.notificationService.sendMultiChannel(userId, {
      email: {
        template: template || TASK_REMINDER_TEMPLATE,
        data: { taskId, taskTitle, remindAt },
      },
      push: { title, body },
    });

    await this.notificationService.createNotification({
      userId,
      type: 'task_reminder',
      title,
      body,
    });

    this.logger.log(`Task reminder delivered successfully for job ${job.id} to user ${userId}`);
    return { delivered: true, userId, taskId };
  }

  @OnQueueFailed()
  async onFailed(job: Job<any>, error: Error): Promise<void> {
    this.logger.error(
      `Notification job ${job.id} (${job.name}) failed on attempt ${job.attemptsMade}: ${error.message}`
    );

    const maxAttempts = job.opts?.attempts || 3;
    if (job.attemptsMade >= maxAttempts) {
      this.logger.warn(
        `Notification job ${job.id} (${job.name}) exhausted all ${job.attemptsMade} attempts. Recording failure.`
      );

      // 1. Move to Dead Letter Queue if available
      if (this.dlq) {
        try {
          await this.dlq.add('failed-job', {
            originalQueue: NOTIFICATION_QUEUE,
            originalJobId: job.id?.toString(),
            originalJobName: job.name,
            originalData: job.data,
            failedReason: error.message,
            attemptsMade: job.attemptsMade,
            timestamp: job.timestamp,
            failedAt: Date.now(),
          });
        } catch (dlqErr: any) {
          this.logger.error(`Failed to move exhausted job ${job.id} to DLQ: ${dlqErr.message}`);
        }
      }

      // 2. Emit failure event for listeners
      this.eventEmitter.emit('notification.failed', {
        jobId: job.id?.toString(),
        jobName: job.name,
        data: job.data,
        error: error.message,
        attemptsMade: job.attemptsMade,
      });

      // 3. Record failed notification record if userId exists
      if (job.data?.userId) {
        try {
          await this.notificationService.createNotification({
            userId: job.data.userId,
            type: 'notification_failed',
            title: 'Notification Delivery Failed',
            body: `Failed to deliver notification (${job.name}) after ${job.attemptsMade} attempts: ${error.message}`,
          });
        } catch (notifErr: any) {
          this.logger.error(`Failed to record notification failure: ${notifErr.message}`);
        }
      }
    }
  }
}
