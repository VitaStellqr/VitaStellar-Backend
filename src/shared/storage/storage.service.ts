import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createHash, randomBytes } from 'crypto';
import { DataExportToken } from '../../database/entities/data-export-token.entity';

export interface UploadResult {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  path: string;
}

export interface DataExportResult {
  exportId: string;
  filePath: string;
  downloadToken: string;
  expiresAt: Date;
}

@Injectable()
export class StorageService {
  private readonly uploadDir = join(process.cwd(), 'uploads');
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @InjectRepository(DataExportToken)
    private readonly exportTokenRepo: Repository<DataExportToken>,
  ) {
    this.ensureUploadDir();
  }

  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(
    file: { originalname: string; buffer: Buffer; mimetype: string },
    folder: string = 'general'
  ): Promise<string> {
    const result = await this.saveFile(file.buffer, file.originalname, file.mimetype, folder);
    return folder ? `${folder}/${result.filename}` : result.filename;
  }

  async getDownloadUrl(fileKey: string): Promise<string> {
    return `/uploads/${fileKey}`;
  }

  async saveFile(
    file: Buffer,
    originalName: string,
    mimetype: string,
    subfolder?: string
  ): Promise<UploadResult> {
    const filename = `${uuidv4()}-${originalName}`;
    const targetDir = subfolder ? join(this.uploadDir, subfolder) : this.uploadDir;

    await this.ensureDirectoryExists(targetDir);

    const filePath = join(targetDir, filename);
    await fs.writeFile(filePath, file);

    const relativePath = subfolder ? `${subfolder}/${filename}` : filename;
    const url = `/uploads/${relativePath}`;

    return {
      filename,
      originalName,
      mimetype,
      size: file.length,
      url,
      path: filePath,
    };
  }

  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.error('Failed to delete file:', error instanceof Error ? error.stack : String(error));
    }
  }

  async deleteFileByUrl(url: string): Promise<void> {
    const relativePath = url.replace('/uploads/', '');
    const filePath = join(this.uploadDir, relativePath);
    await this.deleteFile(filePath);
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getFileStats(filePath: string): Promise<{ size: number; modified: Date } | null> {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        modified: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  getUploadDir(): string {
    return this.uploadDir;
  }

  /**
   * Persist a GDPR JSON export and return a time-limited download token (24h).
   * Token metadata is stored in the database with a SHA-256 hash of the token;
   * the plaintext token is returned to the caller only (for emailing).
   */
  async saveDataExport(
    userId: string,
    payload: Record<string, unknown>
  ): Promise<DataExportResult> {
    const exportId = uuidv4();
    const downloadToken = randomBytes(32).toString('hex');
    const subfolder = join('exports', userId);
    const filename = `${exportId}.json`;
    const content = Buffer.from(JSON.stringify(payload, null, 2), 'utf-8');

    const saved = await this.saveFile(content, filename, 'application/json', subfolder);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const tokenRecord = this.exportTokenRepo.create({
      userId,
      exportId,
      tokenHash: this.hashDownloadToken(downloadToken),
      filePath: saved.path,
      expiresAt,
    });
    await this.exportTokenRepo.save(tokenRecord);

    return { exportId, filePath: saved.path, downloadToken, expiresAt };
  }

  /**
   * Resolve a download token: look up by SHA-256 hash, enforce expiry and
   * one-time use. Returns null if the token is invalid, expired, or already
   * consumed.
   */
  async resolveDataExportDownload(
    downloadToken: string
  ): Promise<{ filePath: string; userId: string; exportId: string } | null> {
    const tokenHash = this.hashDownloadToken(downloadToken);

    const record = await this.exportTokenRepo.findOne({
      where: { tokenHash },
    });

    if (!record) {
      return null;
    }

    if (record.expiresAt.getTime() < Date.now()) {
      await this.cleanupExportRecord(record);
      return null;
    }

    if (record.consumedAt) {
      return null;
    }

    if (!(await this.fileExists(record.filePath))) {
      return null;
    }

    return {
      filePath: record.filePath,
      userId: record.userId,
      exportId: record.exportId,
    };
  }

  /**
   * Mark a token as consumed (one-time use). Call this after the export file
   * has been successfully sent to the client.
   */
  async consumeExportToken(downloadToken: string): Promise<void> {
    const tokenHash = this.hashDownloadToken(downloadToken);
    const record = await this.exportTokenRepo.findOne({ where: { tokenHash } });
    if (record && !record.consumedAt) {
      record.consumedAt = new Date();
      await this.exportTokenRepo.save(record);
    }
  }

  buildDataExportDownloadUrl(downloadToken: string, baseUrl?: string): string {
    const appBase = baseUrl ?? process.env.APP_URL ?? 'http://localhost:3001';
    return `${appBase.replace(/\/$/, '')}/users/data-export/download?token=${downloadToken}`;
  }

  hashDownloadToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Remove expired or consumed export tokens and their associated files.
   * Called by the cleanup scheduler.
   */
  async cleanupExpiredExports(): Promise<number> {
    const now = new Date();
    const expiredRecords = await this.exportTokenRepo.find({
      where: [
        { expiresAt: LessThan(now) },
      ],
    });

    let cleaned = 0;
    for (const record of expiredRecords) {
      await this.cleanupExportRecord(record);
      cleaned++;
    }

    return cleaned;
  }

  private async cleanupExportRecord(record: DataExportToken): Promise<void> {
    try {
      if (record.filePath && (await this.fileExists(record.filePath))) {
        await this.deleteFile(record.filePath);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to delete export file ${record.filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    await this.exportTokenRepo.remove(record);
  }
}
