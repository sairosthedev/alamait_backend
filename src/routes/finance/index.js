const express = require('express');
const router = express.Router();
const balanceSheetRoutes = require('./balanceSheetRoutes');
const maintenanceRoutes = require('./maintenanceRoutes');
const residenceRoutes = require('./residenceRoutes');
const leaseRoutes = require('./leaseRoutes');

// Mount routes
router.use('/balance-sheets', balanceSheetRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/residences', residenceRoutes);
router.use('/leases', leaseRoutes);

module.exports = router; 