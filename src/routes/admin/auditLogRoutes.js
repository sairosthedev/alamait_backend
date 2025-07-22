const express = require('express');
const router = express.Router();
const auditLogController = require('../../controllers/admin/auditLogController');
const authMiddleware = require('../../middleware/authMiddleware');
const roleMiddleware = require('../../middleware/roleMiddleware');

router.get(
  '/',
  authMiddleware,
  roleMiddleware(['admin']),
  auditLogController.getAuditLogs
);

module.exports = router; 