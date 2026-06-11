import { Injectable, Logger } from '@nestjs/common';

export interface CouponReminderPayload {
  userId: string;
  couponId: string;
  code: string;
  expiresAt: Date;
}

export interface PendingTaskDigestPayload {
  userId: string;
  tasks: Array<{
    id: string;
    title: string;
  }>;
}

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async send(payload: NotificationPayload): Promise<void> {
    this.logger.log(`Notification sent to user ${payload.userId}: ${payload.title}`);
  }

  async sendCouponExpiryReminder(payload: CouponReminderPayload): Promise<void> {
    return this.send({
      userId: payload.userId,
      type: 'COUPON_EXPIRY_REMINDER',
      title: 'Coupon Expiring Soon',
      body: `Your coupon ${payload.code} expires within 24 hours.`,
      data: { couponId: payload.couponId, expiresAt: payload.expiresAt },
    });
  }

  async sendPendingTaskDigest(payload: PendingTaskDigestPayload): Promise<void> {
    return this.send({
      userId: payload.userId,
      type: 'PENDING_TASK_DIGEST',
      title: 'Pending Tasks Reminder',
      body: `You have ${payload.tasks.length} incomplete task(s).`,
      data: { taskCount: payload.tasks.length },
    });
  }
}
