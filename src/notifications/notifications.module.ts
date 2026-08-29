import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { NotificationPreferencesModule } from './preferences/preferences.module';
import { NotificationPreference } from './entities/notification-preference.entity';
import { Notification } from './entities/notification.entity';
import { NotificationService } from './services/notification.service';
import { NotificationsController } from './notifications.controller';
import { User } from '../entities/user.entity';
import { Consultation } from '../modules/consultations/entities/consultation.entity';
import { NotificationProcessor } from './processors/notification.processor';
import { NOTIFICATION_QUEUE, REWARD_DEAD_LETTER_QUEUE } from '../queue/queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationPreference, Notification, User, Consultation]),
    NotificationPreferencesModule,
    BullModule.registerQueue(
      {
        name: NOTIFICATION_QUEUE,
      },
      {
        name: REWARD_DEAD_LETTER_QUEUE,
      }
    ),
  ],
  controllers: [NotificationsController],
  providers: [NotificationService, NotificationProcessor],
  exports: [NotificationPreferencesModule, NotificationService, NotificationProcessor],
})
export class NotificationsModule {}
