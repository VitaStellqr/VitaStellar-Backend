import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bull';
import {
  NotificationProcessor,
  EmailNotificationJobData,
  PushNotificationJobData,
  SmsNotificationJobData,
  TaskReminderJobData,
} from './notification.processor';
import { NotificationService } from '../services/notification.service';
import { Consultation } from '../../modules/consultations/entities/consultation.entity';
import { Notification } from '../entities/notification.entity';
import { User } from '../../entities/user.entity';
import {
  NOTIFICATION_QUEUE,
  EMAIL_NOTIFICATION_JOB,
  PUSH_NOTIFICATION_JOB,
  SMS_NOTIFICATION_JOB,
  TASK_REMINDER_JOB,
  REWARD_DEAD_LETTER_QUEUE,
  TASK_REMINDER_TEMPLATE,
} from '../../queue/queue.constants';
import { ConsultationsService } from '../../modules/consultations/consultations.service';
import { QueueService } from '../../shared/queue/queue.service';

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;
  let notificationService: jest.Mocked<Partial<NotificationService>>;
  let eventEmitter: jest.Mocked<Partial<EventEmitter2>>;
  let mockNotificationQueue: jest.Mocked<Partial<any>>;
  let mockDlq: jest.Mocked<Partial<any>>;
  let mockConsultationRepo: jest.Mocked<Partial<any>>;
  let mockNotificationRepo: jest.Mocked<Partial<any>>;
  let mockUserRepo: jest.Mocked<Partial<any>>;

  beforeEach(async () => {
    notificationService = {
      canSendNotification: jest.fn().mockResolvedValue(true),
      sendEmail: jest.fn().mockResolvedValue(true),
      sendPush: jest.fn().mockResolvedValue(true),
      sendSMS: jest.fn().mockResolvedValue(true),
      sendMultiChannel: jest.fn().mockResolvedValue({ email: true, push: true }),
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' } as any),
      getUserPreferences: jest.fn().mockResolvedValue({
        taskReminders: true,
        emailNotifications: true,
        pushNotifications: true,
        smsNotifications: true,
      } as any),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    mockNotificationQueue = {
      add: jest.fn(),
      getJob: jest.fn(),
    };

    mockDlq = {
      add: jest.fn().mockResolvedValue({ id: 'dlq-1' }),
    };

    mockConsultationRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'consult-1',
        userId: 'user-123',
        cancelled: false,
        scheduledAt: new Date(Date.now() + 3600000), // 1 hour in future
      }),
    };

    mockNotificationRepo = {
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((n) => Promise.resolve({ id: 'notif-1', ...n })),
    };

    mockUserRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: NotificationService, useValue: notificationService },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: getQueueToken(NOTIFICATION_QUEUE), useValue: mockNotificationQueue },
        { provide: getQueueToken(REWARD_DEAD_LETTER_QUEUE), useValue: mockDlq },
        { provide: getRepositoryToken(Consultation), useValue: mockConsultationRepo },
        { provide: getRepositoryToken(Notification), useValue: mockNotificationRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    processor = module.get<NotificationProcessor>(NotificationProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // EMAIL_NOTIFICATION_JOB (Consultation reminders & general email)
  // ──────────────────────────────────────────────────────────────────────────

  describe('handleEmailNotification', () => {
    it('should process and deliver a consultation reminder email job', async () => {
      const scheduledAt = new Date(Date.now() + 2 * 3600000).toISOString();
      const job = {
        id: 'job-email-1',
        name: EMAIL_NOTIFICATION_JOB,
        data: {
          userId: 'user-123',
          consultationId: 'consult-1',
          scheduledAt,
        },
      } as Job<EmailNotificationJobData>;

      const result = await processor.handleEmailNotification(job);

      expect(result.delivered).toBe(true);
      expect(notificationService.canSendNotification).toHaveBeenCalledWith('user-123', 'email');
      expect(mockConsultationRepo.findOne).toHaveBeenCalledWith({ where: { id: 'consult-1' } });
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        'user-123',
        'consultation-reminder',
        { consultationId: 'consult-1', scheduledAt }
      );
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          type: 'email',
          title: 'Consultation Reminder',
        })
      );
    });

    it('should skip delivery cleanly when email notifications are disabled in user preferences', async () => {
      notificationService.canSendNotification.mockResolvedValue(false);

      const job = {
        id: 'job-email-2',
        name: EMAIL_NOTIFICATION_JOB,
        data: {
          userId: 'user-123',
          consultationId: 'consult-1',
          scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        },
      } as Job<EmailNotificationJobData>;

      const result = await processor.handleEmailNotification(job);

      expect(result.delivered).toBe(false);
      expect(result.reason).toBe('preferences_disabled');
      expect(notificationService.sendEmail).not.toHaveBeenCalled();
      expect(notificationService.createNotification).not.toHaveBeenCalled();
    });

    it('should skip reminder when consultation was cancelled', async () => {
      mockConsultationRepo.findOne.mockResolvedValue({
        id: 'consult-cancelled',
        userId: 'user-123',
        cancelled: true,
      });

      const job = {
        id: 'job-email-3',
        name: EMAIL_NOTIFICATION_JOB,
        data: {
          userId: 'user-123',
          consultationId: 'consult-cancelled',
          scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        },
      } as Job<EmailNotificationJobData>;

      const result = await processor.handleEmailNotification(job);

      expect(result.delivered).toBe(false);
      expect(result.reason).toBe('consultation_cancelled');
      expect(notificationService.sendEmail).not.toHaveBeenCalled();
    });

    it('should handle late execution gracefully if consultation scheduled time already passed', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour in the past
      const job = {
        id: 'job-email-4',
        name: EMAIL_NOTIFICATION_JOB,
        data: {
          userId: 'user-123',
          consultationId: 'consult-1',
          scheduledAt: pastDate,
        },
      } as Job<EmailNotificationJobData>;

      const result = await processor.handleEmailNotification(job);

      expect(result.delivered).toBe(false);
      expect(result.reason).toBe('consultation_past');
      expect(notificationService.sendEmail).not.toHaveBeenCalled();
    });

    it('should throw when userId is missing', async () => {
      const job = {
        id: 'job-email-5',
        name: EMAIL_NOTIFICATION_JOB,
        data: {
          userId: '',
          consultationId: 'consult-1',
        },
      } as Job<EmailNotificationJobData>;

      await expect(processor.handleEmailNotification(job)).rejects.toThrow('missing userId');
    });

    it('should handle general email notifications without consultationId', async () => {
      const job = {
        id: 'job-email-6',
        name: EMAIL_NOTIFICATION_JOB,
        data: {
          userId: 'user-123',
          template: 'custom-template',
          data: { code: '123456' },
          subject: 'Custom Subject',
          body: 'Custom Body',
        },
      } as Job<EmailNotificationJobData>;

      const result = await processor.handleEmailNotification(job);

      expect(result.delivered).toBe(true);
      expect(notificationService.sendEmail).toHaveBeenCalledWith('user-123', 'custom-template', {
        code: '123456',
      });
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          title: 'Custom Subject',
          body: 'Custom Body',
        })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PUSH_NOTIFICATION_JOB
  // ──────────────────────────────────────────────────────────────────────────

  describe('handlePushNotification', () => {
    it('should deliver push notification when enabled', async () => {
      const job = {
        id: 'job-push-1',
        name: PUSH_NOTIFICATION_JOB,
        data: {
          userId: 'user-123',
          title: 'New Update',
          body: 'Check out new features',
        },
      } as Job<PushNotificationJobData>;

      const result = await processor.handlePushNotification(job);

      expect(result.delivered).toBe(true);
      expect(notificationService.canSendNotification).toHaveBeenCalledWith('user-123', 'push');
      expect(notificationService.sendPush).toHaveBeenCalledWith(
        'user-123',
        'New Update',
        'Check out new features'
      );
    });

    it('should throw error when push delivery fails to allow Bull retries', async () => {
      notificationService.sendPush.mockResolvedValue(false);

      const job = {
        id: 'job-push-2',
        name: PUSH_NOTIFICATION_JOB,
        data: {
          userId: 'user-123',
          title: 'Test',
          body: 'Failing push',
        },
      } as Job<PushNotificationJobData>;

      await expect(processor.handlePushNotification(job)).rejects.toThrow(
        'Failed to deliver push notification'
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SMS_NOTIFICATION_JOB
  // ──────────────────────────────────────────────────────────────────────────

  describe('handleSmsNotification', () => {
    it('should deliver SMS notification and create notification record', async () => {
      const job = {
        id: 'job-sms-1',
        name: SMS_NOTIFICATION_JOB,
        data: {
          userId: 'user-123',
          message: 'Your verification code is 654321',
        },
      } as Job<SmsNotificationJobData>;

      const result = await processor.handleSmsNotification(job);

      expect(result.delivered).toBe(true);
      expect(notificationService.sendSMS).toHaveBeenCalledWith(
        'user-123',
        'Your verification code is 654321'
      );
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          type: 'sms',
          body: 'Your verification code is 654321',
        })
      );
    });

    it('should throw error when SMS delivery fails to allow Bull retries', async () => {
      notificationService.sendSMS.mockResolvedValue(false);

      const job = {
        id: 'job-sms-2',
        name: SMS_NOTIFICATION_JOB,
        data: {
          userId: 'user-123',
          message: 'Failing sms',
        },
      } as Job<SmsNotificationJobData>;

      await expect(processor.handleSmsNotification(job)).rejects.toThrow('Failed to deliver SMS');
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TASK_REMINDER_JOB
  // ──────────────────────────────────────────────────────────────────────────

  describe('handleTaskReminder', () => {
    it('should deliver task reminder multi-channel and create notification record', async () => {
      const remindAt = new Date().toISOString();
      const job = {
        id: 'job-task-1',
        name: TASK_REMINDER_JOB,
        data: {
          userId: 'user-123',
          taskId: 'task-456',
          taskTitle: 'Morning Meditation',
          template: TASK_REMINDER_TEMPLATE,
          remindAt,
        },
      } as Job<TaskReminderJobData>;

      const result = await processor.handleTaskReminder(job);

      expect(result.delivered).toBe(true);
      expect(notificationService.getUserPreferences).toHaveBeenCalledWith('user-123');
      expect(notificationService.sendMultiChannel).toHaveBeenCalledWith(
        'user-123',
        expect.objectContaining({
          email: {
            template: TASK_REMINDER_TEMPLATE,
            data: { taskId: 'task-456', taskTitle: 'Morning Meditation', remindAt },
          },
        })
      );
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          type: 'task_reminder',
          title: 'Task Reminder',
        })
      );
    });

    it('should skip task reminder if user disabled task reminders in preferences', async () => {
      notificationService.getUserPreferences.mockResolvedValue({
        taskReminders: false,
      } as any);

      const job = {
        id: 'job-task-2',
        name: TASK_REMINDER_JOB,
        data: {
          userId: 'user-123',
          taskId: 'task-456',
          taskTitle: 'Drink Water',
        },
      } as Job<TaskReminderJobData>;

      const result = await processor.handleTaskReminder(job);

      expect(result.delivered).toBe(false);
      expect(result.reason).toBe('preferences_disabled');
      expect(notificationService.sendMultiChannel).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // OnQueueFailed & Failure Path
  // ──────────────────────────────────────────────────────────────────────────

  describe('OnQueueFailed and Failure Path', () => {
    it('should not push to DLQ or emit notification.failed before max attempts are reached', async () => {
      const job = {
        id: 'job-failed-1',
        name: EMAIL_NOTIFICATION_JOB,
        data: { userId: 'user-123', consultationId: 'consult-1' },
        attemptsMade: 1,
        opts: { attempts: 3 },
      } as unknown as Job;

      const error = new Error('SMTP connection timed out');
      await processor.onFailed(job, error);

      expect(mockDlq.add).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalledWith('notification.failed', expect.anything());
    });

    it('should record exhausted jobs in DLQ, emit notification.failed, and persist notification record', async () => {
      const job = {
        id: 'job-failed-2',
        name: EMAIL_NOTIFICATION_JOB,
        data: { userId: 'user-123', consultationId: 'consult-1' },
        attemptsMade: 3,
        opts: { attempts: 3 },
        timestamp: Date.now(),
      } as unknown as Job;

      const error = new Error('Fatal SMTP 550 User not found');
      await processor.onFailed(job, error);

      // 1. Move to Dead Letter Queue
      expect(mockDlq.add).toHaveBeenCalledWith(
        'failed-job',
        expect.objectContaining({
          originalQueue: NOTIFICATION_QUEUE,
          originalJobId: 'job-failed-2',
          originalJobName: EMAIL_NOTIFICATION_JOB,
          failedReason: 'Fatal SMTP 550 User not found',
          attemptsMade: 3,
        })
      );

      // 2. Emit failure event
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'notification.failed',
        expect.objectContaining({
          jobId: 'job-failed-2',
          jobName: EMAIL_NOTIFICATION_JOB,
          error: 'Fatal SMTP 550 User not found',
          attemptsMade: 3,
        })
      );

      // 3. Persist failed notification record
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          type: 'notification_failed',
          title: 'Notification Delivery Failed',
          body: expect.stringContaining('Fatal SMTP 550 User not found'),
        })
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Integration between ConsultationService.schedule and NotificationProcessor
  // ──────────────────────────────────────────────────────────────────────────

  describe('ConsultationsService schedule -> NotificationProcessor flow', () => {
    let consultationsService: ConsultationsService;
    let mockQueueService: Partial<QueueService>;
    let mockConsultationRepository: any;
    let mockAvailabilityRepository: any;

    beforeEach(async () => {
      const scheduledAt = new Date(Date.now() + 2 * 3600000); // 2 hours in future

      mockConsultationRepository = {
        create: jest.fn().mockImplementation((dto) => ({ id: 'consult-real-1', ...dto })),
        save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
        findOne: jest.fn().mockResolvedValue({
          id: 'consult-real-1',
          userId: 'user-booking-1',
          scheduledAt,
          cancelled: false,
        }),
      };

      mockAvailabilityRepository = {
        create: jest.fn(),
        save: jest.fn(),
        find: jest.fn(),
      };

      mockQueueService = {
        addDelayedJob: jest.fn().mockResolvedValue({ id: 'delayed-job-1' } as any),
      };

      consultationsService = new ConsultationsService(
        mockConsultationRepository,
        mockAvailabilityRepository,
        mockQueueService as QueueService
      );
    });

    it('proves addDelayedJob payload from ConsultationService.schedule is consumed by processor', async () => {
      const scheduledAt = new Date(Date.now() + 2 * 3600000);
      const userId = 'user-booking-1';

      // 1. Consultation is scheduled
      const savedConsultation = await consultationsService.schedule(userId, scheduledAt);

      expect(savedConsultation).toBeDefined();
      expect(mockQueueService.addDelayedJob).toHaveBeenCalledTimes(1);

      // Extract arguments passed to addDelayedJob
      const [queueName, jobName, jobData, delayMs, jobOptions] = (
        mockQueueService.addDelayedJob as jest.Mock
      ).mock.calls[0];

      expect(queueName).toBe(NOTIFICATION_QUEUE);
      expect(jobName).toBe(EMAIL_NOTIFICATION_JOB);
      expect(jobData).toEqual({
        userId,
        consultationId: savedConsultation.id,
        scheduledAt: scheduledAt.toISOString(),
      });
      expect(delayMs).toBeGreaterThan(0);
      expect(jobOptions).toEqual({ attempts: 3 });

      // 2. Feed exact payload into NotificationProcessor
      const job = {
        id: 'job-delayed-consumed-1',
        name: jobName,
        data: jobData,
      } as Job<EmailNotificationJobData>;

      const processResult = await processor.handleEmailNotification(job);

      // 3. Processor successfully consumes and delivers
      expect(processResult.delivered).toBe(true);
      expect(processResult.userId).toBe(userId);
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        userId,
        'consultation-reminder',
        expect.objectContaining({
          consultationId: savedConsultation.id,
          scheduledAt: scheduledAt.toISOString(),
        })
      );
    });
  });
});
