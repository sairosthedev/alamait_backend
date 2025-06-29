const express = require('express');
const router = express.Router();
const balanceSheetRoutes = require('./balanceSheetRoutes');
const maintenanceRoutes = require('./maintenanceRoutes');
const residenceRoutes = require('./residenceRoutes');
const leaseRoutes = require('./leaseRoutes');
const applicationRoutes = require('./applicationRoutes');
const roomPriceRoutes = require('./roomPriceRoutes');

// Mount routes
router.use('/balance-sheets', balanceSheetRoutes);
router.use('/maintenance', maintenanceRoutes);
router.use('/residences', residenceRoutes);
router.use('/leases', leaseRoutes);
router.use('/applications', applicationRoutes);
router.use('/room-prices', roomPriceRoutes);

module.exports = router; 