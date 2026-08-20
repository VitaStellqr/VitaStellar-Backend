import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { Notification } from '../entities/notification.entity';
import { User } from '../../entities/user.entity';
import { PushNotificationService } from '../../shared/notifications/services/push-notification.service';
import { CacheService } from '../../shared/cache/cache.service';
import { NOTIFICATION_QUEUE } from '../../queue/queue.constants';

describe('NotificationService', () => {
  let service: NotificationService;

  let mockPreferenceRepo: { findOne: jest.Mock };
  let mockNotificationRepo: { find: jest.Mock; count: jest.Mock; update: jest.Mock };
  let mockUserRepo: { findOne: jest.Mock };
  let mockCacheService: { setIfNotExists: jest.Mock };
  let mockQueue: { add: jest.Mock };

  beforeEach(async () => {
    mockPreferenceRepo = { findOne: jest.fn().mockResolvedValue(null) };
    mockNotificationRepo = {
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      update: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    mockUserRepo = { findOne: jest.fn().mockResolvedValue(null) };
    mockCacheService = { setIfNotExists: jest.fn().mockResolvedValue(true) };
    mockQueue = { add: jest.fn().mockResolvedValue({ id: 'job-1' }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(NotificationPreference), useValue: mockPreferenceRepo },
        { provide: getRepositoryToken(Notification), useValue: mockNotificationRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: PushNotificationService, useValue: { sendPushNotification: jest.fn().mockResolvedValue(true) } },
        { provide: CacheService, useValue: mockCacheService },
        { provide: ConfigService, useValue: { get: jest.fn((_: string, def: any) => def) } },
        { provide: getQueueToken(NOTIFICATION_QUEUE), useValue: mockQueue },
      ],
    }).compile();

    service = module.get(NotificationService);
  });

  describe('sendEmail', () => {
    it('enqueues email job when user has email', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });

      const result = await service.sendEmail('user-1', 'verify-email', { name: 'Test', link: 'https://example.com/verify' });

      expect(result).toBe(true);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'email-notification',
        expect.objectContaining({
          userId: 'user-1',
          to: 'test@example.com',
          template: 'verify-email',
          subject: expect.any(String),
        }),
        expect.any(Object),
      );
    });

    it('returns false when user has no email', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', email: null });
      const result = await service.sendEmail('user-1', 'verify-email', {});
      expect(result).toBe(false);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('returns false when email notifications disabled', async () => {
      mockPreferenceRepo.findOne.mockResolvedValue({ emailNotifications: false });
      const result = await service.sendEmail('user-1', 'verify-email', {});
      expect(result).toBe(false);
    });

    it('returns false when deduplicated within cooldown', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
      mockCacheService.setIfNotExists.mockResolvedValue(false);
      const result = await service.sendEmail('user-1', 'verify-email', {});
      expect(result).toBe(false);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('sendSMS', () => {
    it('enqueues SMS job when user has phone number', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', phoneNumber: '+1234567890' });

      const result = await service.sendSMS('user-1', 'Your code is 123456');

      expect(result).toBe(true);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'sms-notification',
        expect.objectContaining({
          userId: 'user-1',
          phoneNumber: '+1234567890',
          message: 'Your code is 123456',
        }),
        expect.any(Object),
      );
    });

    it('returns false when user has no phone number', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', phoneNumber: null });
      const result = await service.sendSMS('user-1', 'test');
      expect(result).toBe(false);
    });
  });

  describe('sendMultiChannel', () => {
    it('queues email and returns results', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });

      const results = await service.sendMultiChannel('user-1', {
        email: { template: 'verify-email', data: { name: 'Test' } },
      });

      expect(results.email).toBe(true);
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
    });
  });
});
