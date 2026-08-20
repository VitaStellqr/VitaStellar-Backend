import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationPreferencesModule } from './preferences/preferences.module';
import { NotificationPreference } from './entities/notification-preference.entity';
import { Notification } from './entities/notification.entity';
import { NotificationService } from './services/notification.service';
import { NotificationProcessor } from './processors/notification.processor';
import { NotificationsController } from './notifications.controller';
import { User } from '../entities/user.entity';
import { QueueModule } from '../queue/queue.module';
import { SmsService } from '../shared/sms/sms.service';
import { ConfigService } from '@nestjs/config';
import { MailModule } from '../shared/mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationPreference, Notification, User]),
    QueueModule,
    MailModule,
    NotificationPreferencesModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    NotificationProcessor,
    SmsService,
  ],
  exports: [NotificationPreferencesModule, NotificationService],
})
export class NotificationsModule {}
