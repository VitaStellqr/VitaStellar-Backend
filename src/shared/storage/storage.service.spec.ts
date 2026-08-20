import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StorageService } from './storage.service';
import { DataExportToken } from '../../database/entities/data-export-token.entity';

describe('StorageService - GDPR export token security', () => {
  let service: StorageService;
  let tokenRepo: jest.Mocked<Repository<DataExportToken>>;

  const mockTokenRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: getRepositoryToken(DataExportToken), useValue: mockTokenRepo },
      ],
    }).compile();

    service = module.get(StorageService);
    tokenRepo = module.get(getRepositoryToken(DataExportToken));
  });

  describe('hashDownloadToken', () => {
    it('returns a consistent SHA-256 hex hash', () => {
      const token = 'a'.repeat(64);
      const hash = service.hashDownloadToken(token);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(service.hashDownloadToken(token)).toBe(hash);
    });

    it('produces different hashes for different tokens', () => {
      const hash1 = service.hashDownloadToken('token-aaa');
      const hash2 = service.hashDownloadToken('token-bbb');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('resolveDataExportDownload', () => {
    it('returns null for unknown token (no plaintext file lookup)', async () => {
      mockTokenRepo.findOne.mockResolvedValue(null);
      const result = await service.resolveDataExportDownload('nonexistent-token');
      expect(result).toBeNull();
      expect(mockTokenRepo.findOne).toHaveBeenCalledWith({
        where: { tokenHash: service.hashDownloadToken('nonexistent-token') },
      });
    });

    it('returns null for expired token and cleans up', async () => {
      const pastDate = new Date(Date.now() - 100000);
      mockTokenRepo.findOne.mockResolvedValue({
        id: 'tok-1',
        userId: 'user-1',
        exportId: 'export-1',
        filePath: '/tmp/export.json',
        expiresAt: pastDate,
        consumedAt: null,
      });
      mockTokenRepo.remove.mockResolvedValue(undefined as any);

      const result = await service.resolveDataExportDownload('expired-token');
      expect(result).toBeNull();
      expect(mockTokenRepo.remove).toHaveBeenCalled();
    });

    it('returns null for already-consumed token', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      mockTokenRepo.findOne.mockResolvedValue({
        id: 'tok-1',
        userId: 'user-1',
        exportId: 'export-1',
        filePath: '/tmp/export.json',
        expiresAt: futureDate,
        consumedAt: new Date(),
      });

      const result = await service.resolveDataExportDownload('consumed-token');
      expect(result).toBeNull();
    });

    it('returns metadata for valid, unconsumed token', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      mockTokenRepo.findOne.mockResolvedValue({
        id: 'tok-1',
        userId: 'user-1',
        exportId: 'export-1',
        filePath: '/tmp/export.json',
        expiresAt: futureDate,
        consumedAt: null,
      });
      jest.spyOn(service, 'fileExists').mockResolvedValue(true);

      const result = await service.resolveDataExportDownload('valid-token');
      expect(result).toEqual({
        filePath: '/tmp/export.json',
        userId: 'user-1',
        exportId: 'export-1',
      });
    });
  });

  describe('consumeExportToken', () => {
    it('marks token as consumed', async () => {
      const record = {
        id: 'tok-1',
        tokenHash: service.hashDownloadToken('token-1'),
        consumedAt: null,
      };
      mockTokenRepo.findOne.mockResolvedValue(record);
      mockTokenRepo.save.mockResolvedValue(undefined as any);

      await service.consumeExportToken('token-1');

      expect(record.consumedAt).toBeInstanceOf(Date);
      expect(mockTokenRepo.save).toHaveBeenCalledWith(record);
    });

    it('does not double-consume', async () => {
      const record = {
        id: 'tok-1',
        tokenHash: service.hashDownloadToken('token-1'),
        consumedAt: new Date(),
      };
      mockTokenRepo.findOne.mockResolvedValue(record);
      mockTokenRepo.save.mockResolvedValue(undefined as any);

      await service.consumeExportToken('token-1');

      expect(mockTokenRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredExports', () => {
    it('removes expired records and returns count', async () => {
      const expiredRecords = [
        { id: 'tok-1', filePath: '/tmp/1.json', remove: jest.fn() },
        { id: 'tok-2', filePath: '/tmp/2.json', remove: jest.fn() },
      ];
      mockTokenRepo.find.mockResolvedValue(expiredRecords as any);
      mockTokenRepo.remove.mockResolvedValue(undefined as any);

      const count = await service.cleanupExpiredExports();

      expect(count).toBe(2);
      expect(mockTokenRepo.remove).toHaveBeenCalledTimes(2);
    });

    it('returns 0 when no expired exports exist', async () => {
      mockTokenRepo.find.mockResolvedValue([]);

      const count = await service.cleanupExpiredExports();

      expect(count).toBe(0);
    });
  });

  describe('token never stored as plaintext file', () => {
    it('saveDataExport stores hash in DB, not a plaintext file', async () => {
      const mockSaved = {
        path: '/tmp/uploads/exports/user-1/export-1.json',
        filename: 'export-1.json',
      };

      jest.spyOn(service, 'saveFile' as any).mockResolvedValue(mockSaved);
      mockTokenRepo.create.mockReturnValue({} as any);
      mockTokenRepo.save.mockResolvedValue({} as any);

      const result = await service.saveDataExport('user-1', { data: 'test' });

      expect(result.downloadToken).toMatch(/^[a-f0-9]{64}$/);
      expect(mockTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          tokenHash: service.hashDownloadToken(result.downloadToken),
        })
      );
    });
  });
});
