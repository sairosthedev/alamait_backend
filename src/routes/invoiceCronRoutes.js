const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/auth');
const { instance: InvoiceCronService } = require('../services/invoiceCronService');

/**
 * Invoice Cron Service Routes
 * 
 * Provides endpoints for managing the invoice cron service:
 * - Get service status
 * - Manually trigger invoice processing
 * - Start/stop the service
 */

// Get invoice cron service status
router.get('/status', auth, checkRole(['admin', 'finance', 'finance_admin']), (req, res) => {
    try {
        const status = InvoiceCronService.getStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('❌ Error getting invoice cron status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get invoice cron status',
            details: error.message
        });
    }
});

// Manually trigger invoice processing
router.post('/trigger', auth, checkRole(['admin', 'finance', 'finance_admin']), async (req, res) => {
    try {
        console.log('🚨 Admin requested manual invoice processing trigger');
        
        const result = await InvoiceCronService.triggerInvoiceProcessing();
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('❌ Manual invoice processing trigger failed:', error);
        res.status(500).json({
            success: false,
            error: 'Manual invoice processing trigger failed',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Start invoice cron service
router.post('/start', auth, checkRole(['admin']), (req, res) => {
    try {
        InvoiceCronService.start();
        res.json({
            success: true,
            message: 'Invoice cron service started successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Failed to start invoice cron service:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start invoice cron service',
            details: error.message
        });
    }
});

// Stop invoice cron service
router.post('/stop', auth, checkRole(['admin']), (req, res) => {
    try {
        InvoiceCronService.stop();
        res.json({
            success: true,
            message: 'Invoice cron service stopped successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('❌ Failed to stop invoice cron service:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to stop invoice cron service',
            details: error.message
        });
    }
});

module.exports = router;

