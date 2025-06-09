const express = require('express');
const router = express.Router();
const balanceSheetRoutes = require('./balanceSheetRoutes');
const maintenanceRoutes = require('./maintenanceRoutes');

// Mount routes
router.use('/balance-sheets', balanceSheetRoutes);
router.use('/maintenance', maintenanceRoutes);

module.exports = router; 