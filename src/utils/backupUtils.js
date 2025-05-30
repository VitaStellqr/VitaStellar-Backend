// Utility for managing backup directory and rotation
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

export function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  return BACKUP_DIR;
}

export function rotateBackups(days = 7) {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR);
  const now = Date.now();
  const cutoff = days * 24 * 60 * 60 * 1000;
  files.forEach(file => {
    const filePath = path.join(BACKUP_DIR, file);
    const stat = fs.statSync(filePath);
    if (now - stat.mtimeMs > cutoff) {
      fs.unlinkSync(filePath);
    }
  });
}

export { BACKUP_DIR };
