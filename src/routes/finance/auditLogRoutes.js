const express = require('express');
const router = express.Router();
const auditLogController = require('../../controllers/finance/auditLogController');
const { auth, checkRole } = require('../../middleware/auth');

// Apply auth and role middleware
router.use(auth);
router.use(checkRole('admin', 'finance_admin', 'finance_user', 'ceo'));

router.get(
  '/',
  auditLogController.getAuditLogs
);

module.exports = router; 