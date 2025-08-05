const express = require('express');
const router = express.Router();
const auditLogController = require('../../controllers/finance/auditLogController');
const { auth, checkRole } = require('../../middleware/auth');

// Apply auth and role middleware
router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user', 'ceo'));

// Get audit logs with comprehensive filtering
router.get('/', auditLogController.getAuditLogs);

// Get audit log statistics
router.get('/stats', auditLogController.getAuditStats);

// Get audit log summary
router.get('/summary', auditLogController.getAuditSummary);

// Get recent audit activity
router.get('/recent', auditLogController.getRecentActivity);

// Get audit log by ID
router.get('/:id', auditLogController.getAuditLogById);

// Get audit logs for a specific user
router.get('/user/:userId', auditLogController.getUserAuditLogs);

// Get audit logs for a specific record
router.get('/record/:recordId', auditLogController.getRecordAuditLogs);

// Export audit logs to CSV
router.get('/export/csv', auditLogController.exportAuditLogs);

// Clean old audit logs (for maintenance)
router.delete('/clean', auditLogController.cleanOldAuditLogs);

module.exports = router; 