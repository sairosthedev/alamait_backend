const express = require('express');
const router = express.Router();
const auditLogController = require('../../controllers/admin/auditLogController');

router.get(
  '/',
  auditLogController.getAuditLogs
);

module.exports = router; 