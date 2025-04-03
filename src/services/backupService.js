const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');

class BackupService {
    constructor() {
        this.backupDir = path.join(__dirname, '../../backups');
        this.execPromise = util.promisify(exec);
        
        // Create backup directory if it doesn't exist
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true });
        }
    }

    async createBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(this.backupDir, `backup-${timestamp}`);
        
        try {
            const uri = process.env.MONGODB_URI;
            const dbName = uri.split('/').pop().split('?')[0];
            
            // Create backup using mongodump
            const command = `mongodump --uri="${uri}" --out="${backupPath}"`;
            await this.execPromise(command);

            // Compress backup
            const compressCommand = `tar -czf "${backupPath}.tar.gz" -C "${backupPath}" .`;
            await this.execPromise(compressCommand);

            // Remove uncompressed backup
            fs.rmSync(backupPath, { recursive: true });

            (`Backup created successfully: ${backupPath}.tar.gz`);
            return `${backupPath}.tar.gz`;
        } catch (error) {
            console.error('Backup creation failed:', error);
            throw error;
        }
    }

    async restoreBackup(backupPath) {
        try {
            const uri = process.env.MONGODB_URI;
            const tempDir = path.join(this.backupDir, 'temp-restore');
            
            // Extract backup
            await this.execPromise(`tar -xzf "${backupPath}" -C "${tempDir}"`);

            // Restore using mongorestore
            const command = `mongorestore --uri="${uri}" "${tempDir}" --drop`;
            await this.execPromise(command);

            // Clean up
            fs.rmSync(tempDir, { recursive: true });

            ('Backup restored successfully');
            return true;
        } catch (error) {
            console.error('Backup restoration failed:', error);
            throw error;
        }
    }

    async cleanupOldBackups(retentionDays = 7) {
        try {
            const files = fs.readdirSync(this.backupDir);
            const now = new Date();

            for (const file of files) {
                const filePath = path.join(this.backupDir, file);
                const stats = fs.statSync(filePath);
                const daysOld = (now - stats.mtime) / (1000 * 60 * 60 * 24);

                if (daysOld > retentionDays) {
                    fs.unlinkSync(filePath);
                    (`Deleted old backup: ${file}`);
                }
            }
        } catch (error) {
            console.error('Backup cleanup failed:', error);
            throw error;
        }
    }

    // Schedule daily backups
    scheduleBackups() {
        // Run backup every 24 hours
        setInterval(async () => {
            try {
                await this.createBackup();
                await this.cleanupOldBackups();
            } catch (error) {
                console.error('Scheduled backup failed:', error);
            }
        }, 24 * 60 * 60 * 1000);

        // Run initial backup
        this.createBackup().catch(console.error);
    }
}

module.exports = new BackupService(); 