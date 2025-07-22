const express = require('express');
const router = express.Router();
const auditLogController = require('../../controllers/finance/auditLogController');
const { auth, checkRole } = require('../../middleware/auth');

router.get(
  '/',
  auth,
  checkRole('admin', 'finance_admin', 'finance_user'),
  auditLogController.getAuditLogs
);

module.exports = router; 