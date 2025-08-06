const express = require('express');
const router = express.Router();
const auditLogController = require('../../controllers/finance/auditLogController');
const { auth, checkRole } = require('../../middleware/auth');

// Apply auth and role middleware
router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user', 'ceo'));

// Get all audit logs
router.get('/', auditLogController.getAuditLogs);

// Get audit log by ID
router.get('/:id', auditLogController.getAuditLogById);

// Get audit logs for a specific user
router.get('/user/:userId', auditLogController.getUserAuditLogs);

module.exports = router; 