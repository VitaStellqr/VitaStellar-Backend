import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CacheService } from '../../shared/cache/cache.service';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { Notification } from '../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { PushNotificationService } from '../../shared/notifications/services/push-notification.service';
import {
  NOTIFICATION_QUEUE,
  EMAIL_NOTIFICATION_JOB,
  SMS_NOTIFICATION_JOB,
} from '../../queue/queue.constants';

export interface NotificationOptions {
  userId: string;
  type?: 'email' | 'sms' | 'push';
  template?: string;
  data?: any;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  private cooldowns: Record<string, number> = {};

  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly pushNotificationService: PushNotificationService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
  ) {
    this.cooldowns = {
      email: this.configService.get<number>('NOTIF_COOLDOWN_EMAIL', 60),
      sms: this.configService.get<number>('NOTIF_COOLDOWN_SMS', 30),
      push: this.configService.get<number>('NOTIF_COOLDOWN_PUSH', 10),
    };
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getUnreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationRepository.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true }
    );
    return { updated: result.affected ?? 0 };
  }

  async createNotification(payload: {
    userId: string;
    type: string;
    title: string;
    body: string;
  }): Promise<Notification> {
    const notification = this.notificationRepository.create({
      ...payload,
      isRead: false,
    });
    return this.notificationRepository.save(notification);
  }

  async canSendNotification(userId: string, channel: 'email' | 'sms' | 'push'): Promise<boolean> {
    const preferences = await this.preferenceRepository.findOne({
      where: { userId },
    });

    if (!preferences) {
      return true;
    }

    switch (channel) {
      case 'email':
        return preferences.emailNotifications;
      case 'sms':
        return preferences.smsNotifications;
      case 'push':
        return preferences.pushNotifications;
      default:
        return true;
    }
  }

  /**
   * Enqueue an email notification for delivery via the notification queue.
   * The email is rendered and sent by NotificationProcessor → MailService.
   * Returns false if the user has disabled email or if deduplicated.
   * Throws if queueing fails (e.g., Redis down).
   */
  async sendEmail(userId: string, template: string, data: any): Promise<boolean> {
    const canSend = await this.canSendNotification(userId, 'email');
    if (!canSend) {
      this.logger.debug(`Email notifications disabled for user ${userId}. Skipping.`);
      return false;
    }

    const cooldown = this.cooldowns.email ?? 60;
    const dedupeKey = `notification:dedupe:${userId}:email`;
    const allowed = await this.cacheService.setIfNotExists(dedupeKey, '1', cooldown);
    if (!allowed) {
      this.logger.debug(`Duplicate email suppressed for user ${userId} within ${cooldown}s`);
      return false;
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.email) {
      this.logger.warn(`User ${userId} has no email address — cannot send ${template}`);
      return false;
    }

    const subject = this.getSubjectForTemplate(template);
    await this.notificationQueue.add(
      EMAIL_NOTIFICATION_JOB,
      {
        userId,
        to: user.email,
        template,
        subject,
        variables: data,
      },
      { attempts: 3 },
    );

    this.logger.log(`Email job enqueued for user ${userId} (template: ${template})`);
    return true;
  }

  /**
   * Enqueue an SMS notification for delivery via the notification queue.
   * The SMS is sent by NotificationProcessor → SmsService.
   * Returns false if the user has disabled SMS or if deduplicated.
   * Throws if queueing fails or if Twilio is not configured.
   */
  async sendSMS(userId: string, message: string): Promise<boolean> {
    const canSend = await this.canSendNotification(userId, 'sms');
    if (!canSend) {
      this.logger.debug(`SMS notifications disabled for user ${userId}. Skipping.`);
      return false;
    }

    const cooldown = this.cooldowns.sms ?? 30;
    const dedupeKey = `notification:dedupe:${userId}:sms`;
    const allowed = await this.cacheService.setIfNotExists(dedupeKey, '1', cooldown);
    if (!allowed) {
      this.logger.debug(`Duplicate SMS suppressed for user ${userId} within ${cooldown}s`);
      return false;
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.phoneNumber) {
      this.logger.warn(`User ${userId} has no phone number — cannot send SMS`);
      return false;
    }

    await this.notificationQueue.add(
      SMS_NOTIFICATION_JOB,
      {
        userId,
        phoneNumber: user.phoneNumber,
        message,
      },
      { attempts: 3 },
    );

    this.logger.log(`SMS job enqueued for user ${userId}`);
    return true;
  }

  async sendPush(userId: string, title: string, body: string): Promise<boolean> {
    const canSend = await this.canSendNotification(userId, 'push');
    if (!canSend) {
      this.logger.debug(`Push notifications disabled for user ${userId}. Skipping.`);
      return false;
    }

    const cooldown = this.cooldowns.push ?? 10;
    const dedupeKey = `notification:dedupe:${userId}:push`;
    const allowed = await this.cacheService.setIfNotExists(dedupeKey, '1', cooldown);
    if (!allowed) {
      this.logger.debug(`Duplicate push suppressed for user ${userId} within ${cooldown}s`);
      return false;
    }

    this.logger.log(`Sending push notification to user ${userId}: ${title} - ${body}`);

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`User ${userId} not found when attempting to send push notification.`);
      return false;
    }

    if (!user.fcmToken) {
      this.logger.warn(`User ${userId} does not have an FCM token registered.`);
      return false;
    }

    const success = await this.pushNotificationService.sendPushNotification(
      user.fcmToken,
      title,
      body
    );

    await this.createNotification({
      userId,
      type: 'push',
      title,
      body,
    });

    return success;
  }

  async sendMultiChannel(
    userId: string,
    options: {
      email?: { template: string; data: any };
      sms?: { message: string };
      push?: { title: string; body: string };
    }
  ): Promise<{ email?: boolean; sms?: boolean; push?: boolean }> {
    const results: { email?: boolean; sms?: boolean; push?: boolean } = {};

    if (options.email) {
      results.email = await this.sendEmail(userId, options.email.template, options.email.data);
    }

    if (options.sms) {
      results.sms = await this.sendSMS(userId, options.sms.message);
    }

    if (options.push) {
      results.push = await this.sendPush(userId, options.push.title, options.push.body);
    }

    return results;
  }

  async getUserPreferences(userId: string): Promise<NotificationPreference | null> {
    return this.preferenceRepository.findOne({ where: { userId } });
  }

  private getSubjectForTemplate(template: string): string {
    const subjects: Record<string, string> = {
      'verify-email': 'Verify your VitaStellar email',
      'password-reset': 'Reset your VitaStellar password',
      'data-export-ready': 'Your VitaStellar data export is ready',
    };
    return subjects[template] || 'VitaStellar Notification';
  }
}
