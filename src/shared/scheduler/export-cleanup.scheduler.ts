import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class ExportCleanupScheduler {
  private readonly logger = new Logger(ExportCleanupScheduler.name);

  constructor(private readonly storageService: StorageService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredExportCleanup() {
    this.logger.log('Starting expired GDPR export cleanup job...');
    try {
      const cleaned = await this.storageService.cleanupExpiredExports();
      this.logger.log(`Export cleanup completed. Removed ${cleaned} expired export(s).`);
    } catch (error: any) {
      this.logger.error(`Failed to cleanup expired exports: ${error.message}`);
    }
  }
}
