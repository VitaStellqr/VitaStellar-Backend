import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { User } from '../entities/user.entity';
import { ReferralRecord } from './entities/referral-record.entity';
import { REWARD_DISTRIBUTION_JOB, REWARD_QUEUE } from '../queue/queue.constants';

describe('ReferralService', () => {
  let service: ReferralService;

  const mockUserRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockReferralRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(),
  };

  const mockRewardQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        {
          provide: getRepositoryToken(ReferralRecord),
          useValue: mockReferralRepo,
        },
        { provide: getQueueToken(REWARD_QUEUE), useValue: mockRewardQueue },
      ],
    }).compile();

    service = module.get(ReferralService);
  });

  describe('generateReferralCode', () => {
    it('returns existing code when user already has one', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-1',
        referralCode: 'EXISTING',
      });

      const result = await service.generateReferralCode('user-1');

      expect(result).toEqual({ referralCode: 'EXISTING' });
      expect(mockUserRepo.save).not.toHaveBeenCalled();
    });

    it('creates a new unique code', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce({ id: 'user-1', referralCode: null })
        .mockResolvedValue(null);
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.generateReferralCode('user-1');

      expect(result.referralCode).toHaveLength(8);
      expect(mockUserRepo.save).toHaveBeenCalled();
    });
  });

  describe('redeemReferralCode', () => {
    it('links user to referrer', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce({ id: 'new-user', referredBy: null })
        .mockResolvedValueOnce({ id: 'referrer', referralCode: 'CODE1234' });
      mockUserRepo.save.mockImplementation((u) => Promise.resolve(u));

      const result = await service.redeemReferralCode('new-user', 'code1234');

      expect(result.referrerId).toBe('referrer');
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    it('throws when code is invalid', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce({ id: 'new-user', referredBy: null })
        .mockResolvedValueOnce(null);

      await expect(
        service.redeemReferralCode('new-user', 'BADCODE1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws when already redeemed', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'new-user',
        referredBy: { id: 'referrer' },
      });

      await expect(
        service.redeemReferralCode('new-user', 'CODE1234'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('handleFirstHealthTaskCompletion', () => {
    it('queues referral reward on first task for referred user', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'referred',
        referredBy: { id: 'referrer' },
      });
      mockReferralRepo.findOne.mockResolvedValue(null);
      mockReferralRepo.save.mockImplementation((r) => { r.id = 'rec-1'; return Promise.resolve(r); });

      await service.handleFirstHealthTaskCompletion({
        userId: 'referred',
        completionId: 'completion-1',
      });

      expect(mockRewardQueue.add).toHaveBeenCalledWith(
        REWARD_DISTRIBUTION_JOB,
        expect.objectContaining({
          userId: 'referrer',
          xlmAmount: 1,
          sourceType: 'referral',
          referralRecordId: 'rec-1',
        }),
      );
      expect(mockReferralRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ rewardPaid: true }),
      );
    });

    it('skips when user has no referrer', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'solo', referredBy: null });

      await service.handleFirstHealthTaskCompletion({ userId: 'solo' });

      expect(mockRewardQueue.add).not.toHaveBeenCalled();
    });

    it('does not mark rewardPaid before payout succeeds', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'referred',
        referredBy: { id: 'referrer' },
      });
      mockReferralRepo.findOne.mockResolvedValue(null);
      mockReferralRepo.save.mockImplementation((r) => Promise.resolve({ ...r, id: 'rec-2' }));

      await service.handleFirstHealthTaskCompletion({
        userId: 'referred',
        completionId: 'completion-1',
      });

      const saveCall = mockReferralRepo.save.mock.calls[0][0];
      expect(saveCall.rewardPaid).toBe(false);
      expect(saveCall.rewardPaidAt).toBeUndefined();
    });

    it('produces exactly one job for duplicate concurrent events', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'referred',
        referredBy: { id: 'referrer' },
      });
      mockReferralRepo.findOne.mockResolvedValue(null);
      let callCount = 0;
      mockReferralRepo.save.mockImplementation((r) => {
        callCount++;
        if (callCount === 2) {
          const err = new Error('unique violation') as any;
          err.code = '23505';
          return Promise.reject(err);
        }
        r.id = 'rec-3';
        return Promise.resolve(r);
      });

      await service.handleFirstHealthTaskCompletion({
        userId: 'referred',
        completionId: 'completion-1',
      });
      await service.handleFirstHealthTaskCompletion({
        userId: 'referred',
        completionId: 'completion-1',
      });

      expect(mockRewardQueue.add).toHaveBeenCalledTimes(1);
    });

    it('skips if record already exists with rewardPaid=true', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'referred',
        referredBy: { id: 'referrer' },
      });
      mockReferralRepo.findOne.mockResolvedValue({ id: 'rec-4', rewardPaid: true });

      await service.handleFirstHealthTaskCompletion({
        userId: 'referred',
        completionId: 'completion-1',
      });

      expect(mockRewardQueue.add).not.toHaveBeenCalled();
    });

    it('skips if record already exists and is queued (rewardPaid=false)', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'referred',
        referredBy: { id: 'referrer' },
      });
      mockReferralRepo.findOne.mockResolvedValue({ id: 'rec-5', rewardPaid: false });

      await service.handleFirstHealthTaskCompletion({
        userId: 'referred',
        completionId: 'completion-1',
      });

      expect(mockRewardQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('handleReferralRewardPaid', () => {
    it('marks rewardPaid when payout succeeds', async () => {
      const record = { id: 'rec-6', rewardPaid: false };
      mockReferralRepo.findOne.mockResolvedValue(record);
      mockReferralRepo.save.mockResolvedValue(record);

      await service.handleReferralRewardPaid({ referralRecordId: 'rec-6' });

      expect(record.rewardPaid).toBe(true);
      expect(record.rewardPaidAt).toBeInstanceOf(Date);
      expect(mockReferralRepo.save).toHaveBeenCalledWith(record);
    });

    it('skips if record already paid', async () => {
      const record = { id: 'rec-7', rewardPaid: true };
      mockReferralRepo.findOne.mockResolvedValue(record);

      await service.handleReferralRewardPaid({ referralRecordId: 'rec-7' });

      expect(mockReferralRepo.save).not.toHaveBeenCalled();
    });

    it('skips if record not found', async () => {
      mockReferralRepo.findOne.mockResolvedValue(null);

      await service.handleReferralRewardPaid({ referralRecordId: 'nonexistent' });

      expect(mockReferralRepo.save).not.toHaveBeenCalled();
    });
  });
});
