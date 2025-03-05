const express = require('express');
const router = express.Router();
const backupService = require('../../services/backupService');
const auth = require('../../middleware/auth');
const admin = require('../../middleware/admin');
const path = require('path');
const fs = require('fs');

// Trigger manual backup
router.post('/create', [auth, admin], async (req, res) => {
    try {
        const backupPath = await backupService.createBackup();
        res.json({ 
            message: 'Backup created successfully',
            path: backupPath
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Backup creation failed',
            details: error.message
        });
    }
});

// Restore from backup
router.post('/restore/:filename', [auth, admin], async (req, res) => {
    try {
        const backupPath = path.join(backupService.backupDir, req.params.filename);
        await backupService.restoreBackup(backupPath);
        res.json({ message: 'Backup restored successfully' });
    } catch (error) {
        res.status(500).json({ 
            error: 'Backup restoration failed',
            details: error.message
        });
    }
});

// List available backups
router.get('/list', [auth, admin], async (req, res) => {
    try {
        const files = fs.readdirSync(backupService.backupDir)
            .filter(file => file.endsWith('.tar.gz'))
            .map(file => {
                const filePath = path.join(backupService.backupDir, file);
                const stats = fs.statSync(filePath);
                return {
                    filename: file,
                    size: stats.size,
                    created: stats.mtime
                };
            })
            .sort((a, b) => b.created - a.created);

        res.json(files);
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to list backups',
            details: error.message
        });
    }
});

// Delete a backup
router.delete('/:filename', [auth, admin], async (req, res) => {
    try {
        const backupPath = path.join(backupService.backupDir, req.params.filename);
        fs.unlinkSync(backupPath);
        res.json({ message: 'Backup deleted successfully' });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to delete backup',
            details: error.message
        });
    }
});

module.exports = router; 