import cron from 'node-cron';
import BackupService from '../service/backupService.js';
import Backup from '../models/Backup.js';

const backupService = new BackupService();

/**
 * Execute backup process
 */
async function executeBackup() {
  const backupId = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  let backupRecord = null;
  
  try {
    console.log(`Starting scheduled backup: ${backupId}`);
    
    // Create backup record in database
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() + (parseInt(process.env.BACKUP_RETENTION_DAYS) || 30));
    
    backupRecord = new Backup({
      backupId,
      status: 'in_progress',
      database: backupService.extractDatabaseName(process.env.MONGO_URI),
      retentionDate
    });
    
    await backupRecord.save();
    
    // Execute backup
    const backupInfo = await backupService.createBackup();
    
    // Update backup record with completion details
    await backupRecord.markCompleted(
      backupInfo.s3Key,
      backupInfo.hash,
      backupInfo.size,
      {
        totalDocuments: 0, // This would be populated from actual dump stats
        totalSize: backupInfo.size,
        compressionRatio: 0.7 // Estimated compression ratio
      }
    );
    
    // Verify backup integrity
    const verification = await backupService.verifyBackupIntegrity(backupInfo.s3Key);
    if (verification.verified) {
      await backupRecord.markVerified(backupInfo.hash);
    }
    
    console.log(`Backup completed successfully: ${backupId}`);
    
    // Cleanup old backups
    await cleanupOldBackups();
    
  } catch (error) {
    console.error(`Backup failed: ${backupId}`, error);
    
    if (backupRecord) {
      await backupRecord.markFailed(error.message);
    }
    
    // Send notification about backup failure (if notification service exists)
    await notifyBackupFailure(backupId, error.message);
  }
}

/**
 * Cleanup old backups
 */
async function cleanupOldBackups() {
  try {
    console.log('Starting cleanup of old backups...');
    
    // Cleanup from S3
    const deletedCount = await backupService.cleanupOldBackups();
    
    // Cleanup from database
    const dbDeletedCount = await Backup.cleanupExpired();
    
    console.log(`Cleanup completed: ${deletedCount} S3 backups, ${dbDeletedCount} database records`);
    
  } catch (error) {
    console.error('Backup cleanup failed:', error);
  }
}

/**
 * Notify about backup failure
 */
async function notifyBackupFailure(backupId, errorMessage) {
  try {
    // This would integrate with your notification service
    // For now, just log the error
    console.error(`BACKUP FAILURE NOTIFICATION: ${backupId} - ${errorMessage}`);
    
    // In a real implementation, you might:
    // - Send email to administrators
    // - Post to Slack/Teams
    // - Create an alert in monitoring system
    
  } catch (error) {
    console.error('Failed to send backup failure notification:', error);
  }
}

/**
 * Get backup statistics
 */
async function getBackupStats() {
  try {
    const stats = await Backup.getBackupStats();
    console.log('Backup Statistics:', JSON.stringify(stats, null, 2));
    return stats;
  } catch (error) {
    console.error('Failed to get backup statistics:', error);
    return null;
  }
}

/**
 * Manual backup trigger (for testing or emergency backups)
 */
async function triggerManualBackup() {
  console.log('Manual backup triggered');
  await executeBackup();
}

// Schedule backup job
// Default: Daily at 2:00 AM UTC (configurable via BACKUP_SCHEDULE env var)
const backupSchedule = process.env.BACKUP_SCHEDULE || '0 2 * * *';

console.log(`Scheduling backup job with cron pattern: ${backupSchedule}`);

const backupJob = cron.schedule(backupSchedule, async () => {
  console.log('Scheduled backup job started');
  await executeBackup();
}, {
  scheduled: true,
  timezone: 'UTC'
});

// Schedule weekly cleanup job (Sundays at 3:00 AM UTC)
const cleanupJob = cron.schedule('0 3 * * 0', async () => {
  console.log('Scheduled cleanup job started');
  await cleanupOldBackups();
}, {
  scheduled: true,
  timezone: 'UTC'
});

// Schedule daily stats logging (Daily at 1:00 AM UTC)
const statsJob = cron.schedule('0 1 * * *', async () => {
  await getBackupStats();
}, {
  scheduled: true,
  timezone: 'UTC'
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Stopping backup cron jobs...');
  backupJob.stop();
  cleanupJob.stop();
  statsJob.stop();
});

process.on('SIGINT', () => {
  console.log('Stopping backup cron jobs...');
  backupJob.stop();
  cleanupJob.stop();
  statsJob.stop();
});

export { 
  executeBackup, 
  cleanupOldBackups, 
  triggerManualBackup, 
  getBackupStats,
  backupJob,
  cleanupJob,
  statsJob
};