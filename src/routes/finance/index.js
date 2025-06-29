const express = require('express');
const router = express.Router();
const balanceSheetRoutes = require('./balanceSheetRoutes');
const maintenanceRoutes = require('./maintenanceRoutes');
const residenceRoutes = require('./residenceRoutes');

// Mount routes
router.use('/balance-sheets', balanceSheetRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/residences', residenceRoutes);

module.exports = router; 